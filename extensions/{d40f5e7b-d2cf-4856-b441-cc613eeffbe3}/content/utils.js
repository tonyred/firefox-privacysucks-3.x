

var bputils = {
        prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch),

    getPref: function(prefName)
    {
        var type = 0;
        try{
            type = bputils.prefs.getPrefType(prefName);
        }catch(e){}
        if (type == 32)
            return bputils.prefs.getCharPref(prefName);
        else if (type == 64)
            return bputils.prefs.getIntPref(prefName);
        else if (type == 128)
            return bputils.prefs.getBoolPref(prefName);
        else
            return undefined;
            //alert("Invalid preference "+prefName+" check that it is listed in defaults/prefs.js");
    },

    setPref: function(prefName, value)
    {
        var type = bputils.prefs.getPrefType(prefName);
        if (type == 32)
            bputils.prefs.setCharPref(prefName, value);
        else if (type == 64)
            bputils.prefs.setIntPref(prefName, value);
        else if (type == 128)
            bputils.prefs.setBoolPref(prefName, value);
        else
            alert("Invalid preference "+prefName+" check that it is listed in defaults/prefs.js");

    },

    clearPref: function(prefName)
    {
        if (bputils.prefs.prefHasUserValue(prefName))
            bputils.prefs.clearUserPref(prefName);
    },

};