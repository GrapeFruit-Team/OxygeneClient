package com.grfruit.purplify;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private WebView loadingOverlay;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean overlayRemoved = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handler.post(this::showLoadingOverlay);
    }

    private void showLoadingOverlay() {
        if (isFinishing() || overlayRemoved || bridge == null || bridge.getWebView() == null) return;

        View mainWebView = bridge.getWebView();
        ViewGroup parent = (ViewGroup) mainWebView.getParent();
        if (parent == null) {
            handler.postDelayed(this::showLoadingOverlay, 150);
            return;
        }

        loadingOverlay = new WebView(this);
        loadingOverlay.setBackgroundColor(Color.rgb(13, 13, 13));
        loadingOverlay.setOverScrollMode(View.OVER_SCROLL_NEVER);
        loadingOverlay.setVerticalScrollBarEnabled(false);
        loadingOverlay.setHorizontalScrollBarEnabled(false);
        loadingOverlay.setClickable(true);
        loadingOverlay.setFocusable(false);
        loadingOverlay.getSettings().setJavaScriptEnabled(false);
        loadingOverlay.getSettings().setDomStorageEnabled(false);
        loadingOverlay.getSettings().setAllowFileAccess(true);
        loadingOverlay.getSettings().setAllowFileAccessFromFileURLs(false);
        loadingOverlay.getSettings().setAllowUniversalAccessFromFileURLs(false);
        loadingOverlay.setWebViewClient(new WebViewClient());

        if (parent instanceof FrameLayout) {
            parent.addView(loadingOverlay, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        } else {
            parent.addView(loadingOverlay, parent.generateDefaultLayoutParams());
            loadingOverlay.setLayoutParams(new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }
        loadingOverlay.bringToFront();
        loadingOverlay.loadUrl("file:///android_asset/public/loading.html");
        handler.postDelayed(this::checkMainPageLoaded, 200);
    }


    private void checkMainPageLoaded() {
        if (overlayRemoved || loadingOverlay == null || bridge == null || bridge.getWebView() == null) return;
        if (bridge.getWebView().getProgress() >= 100) {
            removeLoadingOverlay();
            return;
        }
        handler.postDelayed(this::checkMainPageLoaded, 200);
    }

    private void removeLoadingOverlay() {
        if (overlayRemoved || loadingOverlay == null) return;
        overlayRemoved = true;
        loadingOverlay.animate().alpha(0f).setDuration(350).withEndAction(() -> {
            ViewGroup parent = (ViewGroup) loadingOverlay.getParent();
            if (parent != null) parent.removeView(loadingOverlay);
            loadingOverlay.destroy();
            loadingOverlay = null;
        }).start();
    }


    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (loadingOverlay != null) {
            ViewGroup parent = (ViewGroup) loadingOverlay.getParent();
            if (parent != null) parent.removeView(loadingOverlay);
            loadingOverlay.destroy();
            loadingOverlay = null;
        }
        super.onDestroy();
    }
}
