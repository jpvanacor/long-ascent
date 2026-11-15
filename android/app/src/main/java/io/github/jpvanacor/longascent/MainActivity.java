package io.github.jpvanacor.longascent;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The game keeps an open sheet as one step of web history, so Back closes the sheet.
        // With nothing open, Back puts the game in the background instead of closing it.
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    WebView view = getBridge() == null ? null : getBridge().getWebView();
                    if (view != null && view.canGoBack()) {
                        view.goBack();
                    } else {
                        moveTaskToBack(true);
                    }
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
