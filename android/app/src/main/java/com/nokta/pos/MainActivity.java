package com.nokta.pos;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        handleExternalIntent();
    }

    private void handleExternalIntent() {
        Intent intent = getIntent();
        if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction())) {
            Uri data = intent.getData();
            if (data != null) {
                String url = data.toString();
                if (url.contains("3000") || url.contains("nokta")) {
                    intent.setAction(Intent.ACTION_MAIN);
                    intent.setData(null);
                }
            }
        }
    }
}
