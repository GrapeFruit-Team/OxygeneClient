import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private var loadingOverlay: WKWebView?
    private var progressObservation: NSKeyValueObservation?
    private var overlayShownAt: Date?
    private var overlayDismissed = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.showLoadingOverlay()
        }
        return true
    }

    private func findMainWebView(in view: UIView) -> WKWebView? {
        if let webView = view as? WKWebView, webView !== loadingOverlay { return webView }
        for child in view.subviews {
            if let found = findMainWebView(in: child) { return found }
        }
        return nil
    }

    private func showLoadingOverlay() {
        guard !overlayDismissed, let root = window?.rootViewController?.view else { return }
        root.layoutIfNeeded()
        guard let mainWebView = findMainWebView(in: root) else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { self.showLoadingOverlay() }
            return
        }

        let configuration = WKWebViewConfiguration()
        let overlay = WKWebView(frame: .zero, configuration: configuration)
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.isOpaque = true
        overlay.backgroundColor = UIColor(red: 13.0/255.0, green: 13.0/255.0, blue: 13.0/255.0, alpha: 1.0)
        overlay.scrollView.isScrollEnabled = false
        overlay.scrollView.bounces = false
        overlay.scrollView.contentInsetAdjustmentBehavior = .never
        overlay.isUserInteractionEnabled = true
        root.addSubview(overlay)
        NSLayoutConstraint.activate([
            overlay.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            overlay.topAnchor.constraint(equalTo: root.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: root.bottomAnchor)
        ])
        root.bringSubviewToFront(overlay)
        loadingOverlay = overlay
        overlayShownAt = Date()

        if let publicFolder = Bundle.main.resourceURL?.appendingPathComponent("public", isDirectory: true) {
            let loadingFile = publicFolder.appendingPathComponent("loading.html")
            overlay.loadFileURL(loadingFile, allowingReadAccessTo: publicFolder)
        }

        progressObservation = mainWebView.observe(\.estimatedProgress, options: [.new]) { [weak self] webView, _ in
            guard let self, !self.overlayDismissed, webView.estimatedProgress >= 1.0 else { return }
            let minimumWait: TimeInterval = 1.2
            let elapsed = Date().timeIntervalSince(self.overlayShownAt ?? Date())
            DispatchQueue.main.asyncAfter(deadline: .now() + max(0, minimumWait - elapsed)) {
                self.hideLoadingOverlay()
            }
        }
        if mainWebView.estimatedProgress >= 1.0 {
            let elapsed = Date().timeIntervalSince(overlayShownAt ?? Date())
            DispatchQueue.main.asyncAfter(deadline: .now() + max(0, 1.2 - elapsed)) {
                self.hideLoadingOverlay()
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) { self.hideLoadingOverlay() }
    }

    private func hideLoadingOverlay() {
        guard !overlayDismissed, let overlay = loadingOverlay else { return }
        overlayDismissed = true
        progressObservation?.invalidate()
        progressObservation = nil
        UIView.animate(withDuration: 0.35, animations: {
            overlay.alpha = 0
        }, completion: { _ in
            overlay.removeFromSuperview()
            overlay.stopLoading()
            self.loadingOverlay = nil
        })
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {
        progressObservation?.invalidate()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
