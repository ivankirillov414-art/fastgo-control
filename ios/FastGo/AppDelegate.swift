import UIKit
import WebKit
import Network

final class AssetServer {
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "ru.fastgo.ios.assets")
    private let root: URL
    init(root: URL) { self.root = root.standardizedFileURL }
    func start(_ ready: @escaping (Error?) -> Void) throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: .ipv4(.loopback), port: 17861)
        parameters.allowLocalEndpointReuse = true
        let listener = try NWListener(using: parameters)
        self.listener = listener
        var finished = false
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready: if !finished { finished = true; DispatchQueue.main.async { ready(nil) } }
            case .failed(let error): if !finished { finished = true; DispatchQueue.main.async { ready(error) } }
            default: break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self = self else { connection.cancel(); return }
            connection.start(queue: self.queue)
            self.read(connection, buffer: Data())
        }
        listener.start(queue: queue)
    }
    private func read(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) { [weak self] chunk, _, ended, error in
            guard let self = self, error == nil else { connection.cancel(); return }
            var data = buffer; if let chunk = chunk { data.append(chunk) }
            guard data.count <= 65536 else { connection.cancel(); return }
            guard data.range(of: Data("\r\n\r\n".utf8)) != nil else {
                if ended { connection.cancel() } else { self.read(connection, buffer: data) }; return
            }
            let line = String(decoding: data, as: UTF8.self).components(separatedBy: "\r\n")[0].split(separator: " ")
            guard line.count >= 2, line[0] == "GET" || line[0] == "HEAD" else { self.reply(connection, code: 405, type: "text/plain", body: Data()); return }
            let raw = String(line[1]).components(separatedBy: "?")[0]
            guard let decoded = raw.removingPercentEncoding else { connection.cancel(); return }
            let file = self.root.appendingPathComponent(decoded == "/" ? "workshop.html" : String(decoded.drop(while: { $0 == "/" }))).standardizedFileURL
            guard file.path.hasPrefix(self.root.path + "/"), let body = try? Data(contentsOf: file) else { self.reply(connection, code: 404, type: "text/plain", body: Data()); return }
            let types = ["html":"text/html; charset=utf-8", "js":"text/javascript; charset=utf-8", "css":"text/css; charset=utf-8", "json":"application/json", "svg":"image/svg+xml", "png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "woff2":"font/woff2", "wasm":"application/wasm"]
            self.reply(connection, code: 200, type: types[file.pathExtension] ?? "application/octet-stream", body: line[0] == "HEAD" ? Data() : body)
        }
    }
    private func reply(_ connection: NWConnection, code: Int, type: String, body: Data) {
        let reason = code == 200 ? "OK" : code == 404 ? "Not Found" : "Method Not Allowed"
        var response = Data("HTTP/1.1 \(code) \(reason)\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n".utf8)
        response.append(body)
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }
}

final class FastGoController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var browser: WKWebView!
    private var server: AssetServer?
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = UIColor(red: 0.04, green: 0.07, blue: 0.12, alpha: 1)
        let configuration = WKWebViewConfiguration(); configuration.websiteDataStore = .default(); configuration.allowsInlineMediaPlayback = true
        browser = WKWebView(frame: .zero, configuration: configuration); browser.navigationDelegate = self; browser.uiDelegate = self
        browser.isOpaque = false; browser.backgroundColor = view.backgroundColor; browser.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(browser)
        NSLayoutConstraint.activate([browser.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), browser.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor), browser.leadingAnchor.constraint(equalTo: view.leadingAnchor), browser.trailingAnchor.constraint(equalTo: view.trailingAnchor)])
        guard let root = Bundle.main.url(forResource: "web", withExtension: nil) else { failed("Не найдены файлы приложения"); return }
        server = AssetServer(root: root)
        do { try server?.start { [weak self] error in
            if let error = error { self?.failed(error.localizedDescription); return }
            self?.browser.load(URLRequest(url: URL(string: "http://127.0.0.1:17861/workshop.html")!))
        }} catch { failed(error.localizedDescription) }
    }
    private func failed(_ message: String) { let label = UILabel(); label.text = "Не удалось открыть FastGo: \(message)"; label.textColor = .white; label.numberOfLines = 0; label.frame = view.bounds.insetBy(dx: 24, dy: 80); view.addSubview(label) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error.localizedDescription) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error.localizedDescription) }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        #if DEBUG
        if ProcessInfo.processInfo.environment["FASTGO_SMOKE_TEST"] == "1" { inspectInstalledUI() }
        #endif
    }
    #if DEBUG
    private func inspectInstalledUI(_ attempt: Int = 0) {
        let script = """
        (() => { const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }; return { url: location.href, title: document.title, readyState: document.readyState, text: document.body.innerText.slice(0, 4000), ready: visible(document.querySelector('#login input[type=email]')) && visible(document.querySelector('#login button[type=submit]')), buttons: [...document.querySelectorAll('button')].filter(visible).map(el => el.innerText) }; })()
        """
        browser.evaluateJavaScript(script) { [weak self] result, error in
            var report = result as? [String: Any] ?? ["ready": false]
            report["attempt"] = attempt
            if let error = error { report["error"] = error.localizedDescription }
            if let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]), let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first {
                try? data.write(to: cache.appendingPathComponent("fastgo-ui-smoke.json"), options: .atomic)
            }
            if report["ready"] as? Bool != true && attempt < 60 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self?.inspectInstalledUI(attempt + 1) } }
        }
    }
    #endif
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "about" || url.scheme == "blob" || url.host == "127.0.0.1" && url.port == 17861 { decisionHandler(.allow); return }
        if ["https", "tel", "mailto"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }; decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { if url.host == "127.0.0.1" { webView.load(URLRequest(url: url)) } else if ["https", "tel", "mailto"].contains(url.scheme ?? "") { UIApplication.shared.open(url) } }; return nil
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) { let alert = UIAlertController(title: "FastGo", message: message, preferredStyle: .alert); alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }); present(alert, animated: true) }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) { let alert = UIAlertController(title: "FastGo", message: message, preferredStyle: .alert); alert.addAction(UIAlertAction(title: "Отмена", style: .cancel) { _ in completionHandler(false) }); alert.addAction(UIAlertAction(title: "Продолжить", style: .default) { _ in completionHandler(true) }); present(alert, animated: true) }
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(origin.host == "127.0.0.1" ? .prompt : .deny) }
}

@main final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds); window?.rootViewController = FastGoController(); window?.makeKeyAndVisible(); return true
    }
}
