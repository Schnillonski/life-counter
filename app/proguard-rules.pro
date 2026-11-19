# Die JS-Bridge wird per Reflection aus der WebView aufgerufen und darf nicht umbenannt/entfernt werden.
-keepclassmembers class de.lifecounter.app.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
