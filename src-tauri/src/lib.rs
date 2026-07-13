use std::net::TcpStream;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

// Express 后端固定监听这个端口——避开 80（需要管理员权限）和常见的 3000/8080，
// 也避免和用户手动用 npm start 起的开发服务冲突。
const APP_PORT: u16 = 47823;

struct ServerChild(Mutex<Option<CommandChild>>);

fn wait_for_server(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let resource_dir = app
                .path()
                .resource_dir()
                .expect("无法解析 resource 目录");
            let app_dir = resource_dir.join("kt-app");
            let server_entry = app_dir.join("server").join("index.js");

            let (mut rx, child) = app
                .shell()
                .sidecar("node")
                .expect("找不到打包的 node sidecar 可执行文件")
                .current_dir(app_dir)
                .env("PORT", APP_PORT.to_string())
                .env("KT_PARENT_PID", std::process::id().to_string())
                .args([server_entry.to_string_lossy().to_string()])
                .spawn()
                .expect("启动内嵌 Node 服务失败");

            app.manage(ServerChild(Mutex::new(Some(child))));

            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            log::info!("[server] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            log::error!("[server] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Error(err) => {
                            log::error!("[server] 进程错误：{err}");
                        }
                        CommandEvent::Terminated(payload) => {
                            log::warn!("[server] 已退出：{:?}", payload.code);
                        }
                        _ => {}
                    }
                }
            });

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let ready = wait_for_server(APP_PORT, Duration::from_secs(20));
                let url = if ready {
                    format!("http://127.0.0.1:{APP_PORT}")
                } else {
                    log::error!("[server] 20 秒内没有就绪，仍尝试打开窗口");
                    format!("http://127.0.0.1:{APP_PORT}")
                };
                WebviewWindowBuilder::new(
                    &handle,
                    "main",
                    WebviewUrl::External(url.parse().expect("拼接出的地址无效")),
                )
                .title("Kept Things")
                .inner_size(1180.0, 800.0)
                .min_inner_size(720.0, 560.0)
                .build()
                .expect("创建主窗口失败");
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|handle, event| {
            // 正常退出（关闭窗口、Cmd+Q 等）时立刻杀掉内嵌的 Node 服务；
            // 如果壳本身被强制杀掉走不到这里，server/index.js 里的
            // KT_PARENT_PID 监控是兜底，晚几秒也会自己退出。
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = handle.try_state::<ServerChild>() {
                    if let Some(child) = state.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
