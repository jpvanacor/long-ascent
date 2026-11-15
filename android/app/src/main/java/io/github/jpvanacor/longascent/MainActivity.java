package io.github.jpvanacor.longascent;

import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Back closes what is open in the game: a card first, then the city view. The page is asked directly.
        // Its web history cannot be counted on for this: newer web views skip steps a page added without a touch.
        // With nothing open, Back puts the game in the background instead of closing it.
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    final WebView view = getBridge() == null ? null : getBridge().getWebView();
                    if (view == null) {
                        moveTaskToBack(true);
                        return;
                    }
                    view.evaluateJavascript(
                        "(function(){try{return typeof window.__back==='function'?!!window.__back():null}catch(e){return null}})()",
                        new ValueCallback<String>() {
                            @Override
                            public void onReceiveValue(String closed) {
                                if ("true".equals(closed)) {
                                    return;
                                }
                                if (!"false".equals(closed) && view.canGoBack()) {
                                    view.goBack();          // a page without the hook: fall back on its history
                                    return;
                                }
                                moveTaskToBack(true);
                            }
                        }
                    );
                }
            }
        );
    }

    // Tell the page when the app leaves and returns to the screen, so it can save and stop the music.
    @Override
    public void onPause() {
        super.onPause();
        if (getBridge() != null) {
            getBridge().triggerDocumentJSEvent("apppause");
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getBridge() != null) {
            getBridge().triggerDocumentJSEvent("appresume");
        }
    }
}
