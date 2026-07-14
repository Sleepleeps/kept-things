use std::net::TcpStream;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

// Express 后端固定监听这个端口——避开 80（需要管理员权限）和常见的 3000/8080，
// 也避免和用户手动用 npm start 起的开发服务冲突。
const APP_PORT: u16 = 47823;

// Windows 上 Tauri 的 resource_dir() 返回的是带 \\?\ 前缀的「扩展长度路径」
// （verbatim path）。把这种路径当脚本路径传给 Node，Node 解析主模块时会把
// 盘符 `E:` 错当成一段路径去 lstat，直接崩掉（EISDIR: lstat 'E:'）。这里把
// \\?\ 前缀去掉，还原成普通的 E:\... 形式；真正的网络 UNC 路径（\\?\UNC\...）
// 保持不动，避免破坏它。
fn strip_verbatim_prefix(p: PathBuf) -> PathBuf {
    if let Some(s) = p.to_str() {
        if let Some(rest) = s.strip_prefix(r"\\?\") {
            if !rest.starts_with("UNC\\") {
                return PathBuf::from(rest);
            }
        }
    }
    p
}

struct ServerChild(Mutex<Option<CommandChild>>);

// 服务器起不来时用的兜底错误页。做成一个 data: URL，不依赖后端也不依赖任何
// 外部文件，保证一定能显示出来（而不是白屏 + 「127.0.0.1 拒绝连接」）。
fn server_error_page(port: u16) -> String {
    let html = format!(
        "<!doctype html><html lang=\"zh\"><head><meta charset=\"utf-8\">\
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\
<title>Kept Things</title>\
<style>body{{font-family:system-ui,sans-serif;background:#EFE44D;color:#1E2AA8;\
margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px}}\
.box{{max-width:560px;background:#FAF3D6;border:2px solid #1E2AA8;\
box-shadow:6px 7px 0 rgba(19,27,112,.28);padding:28px 30px}}\
h1{{font-size:22px;margin:0 0 14px}}p{{line-height:1.7;margin:8px 0}}\
code{{background:rgba(30,42,168,.12);padding:1px 6px;border-radius:3px}}</style></head>\
<body><div class=\"box\"><h1>后台服务没能启动 😕</h1>\
<p>Kept Things 的本地服务（端口 <code>{port}</code>）在 20 秒内没有就绪，所以看板没打开。</p>\
<p>可以先这样排查：</p>\
<p>· 端口 <code>{port}</code> 可能被别的程序占用了，关掉那个程序再重开本应用；<br>\
· 如果刚装好，重启一次电脑再打开；<br>\
· Windows 上如果杀毒软件拦了内置的 Node 服务，把本应用加进白名单。</p>\
<p>反复打不开的话，把这段说明连同现象截图发给作者帮忙看看。</p></div></body></html>"
    );
    format!("data:text/html;charset=utf-8,{}", urlencode(&html))
}

// 只对 data: URL 里必须转义的字符做百分号编码，足够让这段固定 HTML 安全传入
// WebView，不引入额外依赖。
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

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

            let resource_dir = strip_verbatim_prefix(
                app.path()
                    .resource_dir()
                    .expect("无法解析 resource 目录"),
            );
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
                let target = if ready {
                    WebviewUrl::External(
                        format!("http://127.0.0.1:{APP_PORT}")
                            .parse()
                            .expect("拼接出的地址无效"),
                    )
                } else {
                    // 服务器 20 秒内没起来：与其甩给用户一个「拒绝连接」的白屏，
                    // 不如显示一个能看懂、能照着排查的错误页。
                    log::error!("[server] 20 秒内没有就绪，改为显示错误页");
                    WebviewUrl::External(
                        server_error_page(APP_PORT).parse().expect("错误页地址无效"),
                    )
                };
                WebviewWindowBuilder::new(&handle, "main", target)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_windows_verbatim_prefix() {
        assert_eq!(
            strip_verbatim_prefix(PathBuf::from(r"\\?\E:\apps\kept-things")),
            PathBuf::from(r"E:\apps\kept-things")
        );
    }

    #[test]
    fn keeps_real_unc_paths_intact() {
        let unc = PathBuf::from(r"\\?\UNC\server\share\kept-things");
        assert_eq!(strip_verbatim_prefix(unc.clone()), unc);
    }

    #[test]
    fn leaves_plain_paths_untouched() {
        for p in [r"E:\apps\kept-things", "/home/user/kept-things"] {
            assert_eq!(strip_verbatim_prefix(PathBuf::from(p)), PathBuf::from(p));
        }
    }
}
