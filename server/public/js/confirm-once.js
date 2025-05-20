/**
 * Ein Hilfsskript, um zu verhindern, dass Bestätigungsdialoge mehrfach angezeigt werden.
 * Dieses Skript überschreibt die window.confirm-Funktion, um zu verhindern, dass sie
 * für dieselbe Nachricht mehrfach aufgerufen wird.
 */

(function() {
    console.log("[Confirm] Installing confirm-once patch");
    
    // Speichere eine Referenz auf die ursprüngliche confirm-Funktion
    const originalConfirm = window.confirm;
    
    // Tracking-Variablen
    let lastConfirmTime = 0;
    let lastConfirmMessage = '';
    let lastConfirmResult = false;
    
    // Überschreibe die confirm-Funktion
    window.confirm = function(message) {
        console.log(`[Confirm] Confirm dialog requested: ${message}`);
        
        const now = Date.now();
        
        // Wenn dasselbe Bestätigungsfenster innerhalb von 3 Sekunden wieder angezeigt werden soll,
        // gib einfach das vorherige Ergebnis zurück
        if (message === lastConfirmMessage && now - lastConfirmTime < 3000) {
            console.log(`[Confirm] Reusing previous result: ${lastConfirmResult}`);
            return lastConfirmResult;
        }
        
        // Sonst rufe die ursprüngliche confirm-Funktion auf
        lastConfirmTime = now;
        lastConfirmMessage = message;
        lastConfirmResult = originalConfirm.call(window, message);
        
        console.log(`[Confirm] User selected: ${lastConfirmResult}`);
        return lastConfirmResult;
    };
    
    console.log("[Confirm] Confirm-once patch installed");
})();