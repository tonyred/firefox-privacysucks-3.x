



var bpopt = {
	WindowObjectReference: null,
	prompts: Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService),
	prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.bprivacy."),

	HelpPageDisplay: function(page)
	{
		if(bpopt.WindowObjectReference == null || bpopt.WindowObjectReference.closed)
		{
			try{
				bpopt.WindowObjectReference = window.open(page, "", "width=800,height=600,alwaysRaised=yes,resizable=yes,scrollbars=yes,status=no");
			}catch(e){;}
    	}
	},


	//Options window opened
	init: function()
	{

		try{

		window.sizeToContent();

		bpriv.LSOTreeShow(bpriv.GetFlashDir(0));

		if(
			( !bputils.getPref("extensions.bprivacy.sendpings.allowed") && (bputils.getPref("extensions.bprivacy.sendpings.allowed") != bputils.getPref("browser.send_pings")) )
		)
		{
			if(confirm("BetterPrivacy:\r\nThe addon detected that one or more privacy settings have been modified!\r\nPress OK to correct those values.")){
				bputils.setPref("browser.send_pings", bputils.getPref("extensions.bprivacy.sendpings.allowed"));
			}
		}
		var interval = bputils.getPref("extensions.bprivacy.DelTimerInterval");
		var selidx = 2;
		var val = 1;
		if(interval % 86400 == 0){//days
			val = interval / 86400;
			selidx = 3;
		}else if(interval % 3600  == 0){ //hours
			val = interval / 3600;
			selidx = 2;
		}else if(interval % 60 == 0){ //minutes
			val = interval / 60;
			selidx = 1;
		}else if(interval >= 1){
			val = Math.round(interval);
			selidx = 0;
		}
		document.getElementById("delInterval").value = val;
		document.getElementById("unitList").selectedIndex = selidx;

		document.getElementById("AutoDelLSOnExitModeID").selectedIndex = bputils.getPref("extensions.bprivacy.AutoDelLSOnExitMode");
		if(bpriv.isSeaMonkey)
			document.getElementById("DelLSONoDialog").label = "Do nothing";

		var sinceDate = bpriv.getString("since") + " ";
		try{
			sinceDate += bpopt.prefs.getComplexValue("lastSession", Components.interfaces.nsISupportsString).data; //new format may not be available the first time
		}catch(e){sinceDate += bpriv.getString("installation");}
		document.getElementById("SessionLabelID").value = sinceDate;

		document.getElementById("KeyCodeLabel").value = bputils.getPref("extensions.bprivacy.keymodifiers") + " + ";
		if(bputils.getPref("extensions.bprivacy.keycode"))
			document.getElementById ("KeyCodeBox").value = String.fromCharCode(bputils.getPref("extensions.bprivacy.keycode"));

		bpopt.AutoIntervalToggled();
		bpopt.AutoDelLSOToggled();
		bpopt.AlwaysReScanToggled(false);
		bpopt.NotifyOnNewLSOToggled();

    var FFVersion = Components.classes["@mozilla.org/xre/app-info;1"]
           .getService(Components.interfaces.nsIXULAppInfo).version;
    if (parseInt(FFVersion.charAt(0)) < 4)
		  document.getElementById("DOMStorage").setAttribute("hidden", "false");
		document.getElementById("MacAcceptBtn").focus();
		}catch(e){alert("An error occured while opening BetterPrivacy\r\nPlease send the following information to the author: \r\n"+e);}
	},






	accept: function(byButton)
	{
		try{
    	if(document.getElementById("alwaysReScanPref").checked)
			bputils.setPref("extensions.bprivacy.alwaysReScan", true);
		else
			bputils.setPref("extensions.bprivacy.alwaysReScan", false);

    	if(document.getElementById("AutoDelLSOOnStartPref").checked)
			bputils.setPref("extensions.bprivacy.AutoDelLSOnStart", true);
		else
			bputils.setPref("extensions.bprivacy.AutoDelLSOnStart", false);

		if(document.getElementById("AutoDelLSOnExitModeID").selectedIndex >= 0)
			bputils.setPref("extensions.bprivacy.AutoDelLSOnExitMode", document.getElementById("AutoDelLSOnExitModeID").selectedIndex);

    	if(document.getElementById("AskOnExitPref").checked)
			bputils.setPref("extensions.bprivacy.donotaskonexit", false);
		else
			bputils.setPref("extensions.bprivacy.donotaskonexit", true);

    	if(document.getElementById("AutoDelIntervalPref").checked){
			bputils.setPref("extensions.bprivacy.useDelTimer", true);
		}else{
			bputils.setPref("extensions.bprivacy.useDelTimer", false);
		}

    	if(document.getElementById("AutoDelIntervalDelayPref").checked){
			bputils.setPref("extensions.bprivacy.useDelTimerDelay", true);
		}else{
			bputils.setPref("extensions.bprivacy.useDelTimerDelay", false);
		}

    	if(document.getElementById("AutoDelDCPref").checked){
			bputils.setPref("extensions.bprivacy.DefaultFlashCookieDeletion", true);
		}else{
			bputils.setPref("extensions.bprivacy.DefaultFlashCookieDeletion", false);
		}

    	if(document.getElementById("AutoDelDirsPref").checked){
			bputils.setPref("extensions.bprivacy.delDirs", true);
		}else{
			bputils.setPref("extensions.bprivacy.delDirs", false);
		}

    	if(document.getElementById("NotifyOnNewLSOPref").checked){
			bputils.setPref("extensions.bprivacy.NotifyOnNewLSO", 2);
		}else{
			bputils.setPref("extensions.bprivacy.NotifyOnNewLSO", 0);
		}

		bputils.setPref("extensions.bprivacy.NotifyDuration", parseInt(document.getElementById("NotifyDurationID").value));

    	if(document.getElementById("ClearDOMPref").checked){
			bputils.setPref("extensions.bprivacy.domclear", true);
		}else{
			bputils.setPref("extensions.bprivacy.domclear", false);
		}

    	if(document.getElementById("DisablePingPref").checked){
			bputils.setPref("browser.send_pings", false);
			bputils.setPref("extensions.bprivacy.sendpings.allowed", false);
		}else{
			bputils.setPref("browser.send_pings", true);
			bputils.setPref("extensions.bprivacy.sendpings.allowed", true);
		}

    	var interval = document.getElementById("delInterval").value;
		var idx = document.getElementById("unitList").selectedIndex;
		var factor = 60 * 60; //default hours
		if(idx == 0)
			factor = 1; //seconds
		else if(idx == 1)
			factor = 60;  //minutes
		else if(idx == 2)
			factor = 60 * 60; //hours
		else if(idx == 3)
			factor = 60 * 60 * 24; //days
		interval = interval * factor;
		bputils.setPref("extensions.bprivacy.DelTimerInterval", interval);
		bputils.setPref("extensions.bprivacy.removedSession", 0);//statistics
		var cDate = new Date();
		var localDate = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
		localDate.data = cDate.toLocaleString();
		bpopt.prefs.setComplexValue("lastSession", Components.interfaces.nsISupportsString, localDate);//for statistics

    var keycodeBox = document.getElementById ("KeyCodeBox");
		if(keycodeBox){
			var value = keycodeBox.value ? keycodeBox.value.charCodeAt(0) : 0;
			bputils.setPref("extensions.bprivacy.keycode", value);
		}
		bpriv.SetKeys();
		}catch(e){alert("An error occured while saving BetterPrivacy options\r\nPlease send the following information to the author: \r\n"+e);}
	},




	AutoDelLSOToggled: function()
	{
    	if(!document.getElementById("AutoDelLSOnExitModeID").selectedIndex)
			document.getElementById("AskOnExitPref").disabled = false;
		else
			document.getElementById("AskOnExitPref").disabled = true;
	},


	AutoIntervalToggled: function()
	{
			if(document.getElementById("AutoDelIntervalPref").checked == false){
				document.getElementById("AutoDelIntervalDelayPref").disabled = true;
				document.getElementById("delIntervallabel").disabled = true;
				document.getElementById("delInterval").disabled = true;
				document.getElementById("unitList").disabled = true;
			}else{
				document.getElementById("AutoDelIntervalDelayPref").disabled = false;
				document.getElementById("delIntervallabel").disabled = false;
				document.getElementById("delInterval").disabled = false;
				document.getElementById("unitList").disabled = false;
			}
	},


	AlwaysReScanToggled: function(byButton)
	{

			if(byButton && document.getElementById("alwaysReScanPref").checked == true)
			{
				if(!confirm(bpriv.getString("alwaysRescan")))
					document.getElementById("alwaysReScanPref").checked = false;
			}
			if(document.getElementById("alwaysReScanPref").checked == false){
				document.getElementById("selectFolderID").disabled = false;
			}else{
				document.getElementById("selectFolderID").disabled = true;
			}
	},


/*
	propagateToggled: function()
	{
		bputils.setPref("extensions.bprivacy.propagate", !bputils.getPref("extensions.bprivacy.propagate"));
		bpriv.setPropagation();
	},
*/

	DelIntervalToggled: function()
	{
                bpriv.tStart = new Date();
	},




	NotifyOnNewLSOToggled: function(byuser)
	{
		if(document.getElementById("NotifyOnNewLSOPref").checked == true){
			var message = bpriv.getString("constantparsingwarning");
			if(byuser && !bpopt.prompts.confirm(null, "BetterPrivacy Warning", message))
			{
				document.getElementById("NotifyOnNewLSOPref").checked = false;
				return;
			}
			document.getElementById("NotifyDurationID").disabled = false;
		}else{
			document.getElementById("NotifyDurationID").disabled = true;
		}
	},


	initPL: function()
	{
		//arrList = bputils.getPref("extensions.bprivacy.protectedLSOList").split("|");
		var arrList = bpriv.prefs.getComplexValue("Exclusions", Components.interfaces.nsISupportsString).data.split("|");

		var listBox = document.getElementById ("listBox");
		for (var j=0;j<arrList.length;j++) {
				try{
						var val = "";
						val = arrList.slice(j,j+1).toString();
						if(val.length > 0)
							listBox.appendChild (bpopt.newListItem (val, val));
				}catch(e){}
		}
		arrList = null;
	},



	acceptPL: function()
	{
			var list = [];
			var listBox = document.getElementById ("listBox");
			var rows = listBox.getRowCount ();
			for (var n = 0; n < rows; n++)
			{
				var listitem = listBox.getItemAtIndex (n);
				var listcell = listitem.childNodes.item (0);
				var value = listcell.getAttribute("value").replace(/[\\\/]$/i, "");
				list.push (value);
			}
			//bputils.getPref("extensions.bprivacy.protectedLSOList", list.join("|").toString());
			var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
			str.data = list.join("|");
			bpriv.prefs.setComplexValue("Exclusions", Components.interfaces.nsISupportsString, str);
	},


	EditPL: function()
	{
		//modal window
		window.open("chrome://bp/content/editpl.xul", "", "chrome=yes,modal=yes,resizable=yes,width=750,height=350");

		//bpriv.LSOTreeShow(bpriv.GetFlashDir(0));
		bpriv.RefreshLSOProtection();
		//bpriv.updateGUI(bpriv.GetFlashDir(0), false);
		bpriv.updateGUI(false);
		bpriv.TreeOnSelect();
	},


	newListItem: function (label, value)
	{
		var row = document.createElement ("listitem");
		row.setAttribute ("allowevents", true);
		var cell = document.createElement ("listcell");
		cell.setAttribute ("id", "");
		cell.setAttribute ("label", label);
		cell.setAttribute ("value", value);
		row.appendChild (cell);
		return row;
	},


	listTextboxOnInput: function  (event)
	{
		var add = document.getElementById ("listAdd");
		var textbox = event.target;
		if (0 < textbox.textLength)
		{
			add.removeAttribute ("disabled");
		}
		else
		{
			add.setAttribute ("disabled", true);
		}
	},

	listBoxOnSelect: function  (event)
	{
		document.getElementById ("listEdit").removeAttribute ("disabled");
		document.getElementById ("listRemove").removeAttribute ("disabled");
	},


	listAddOnCommand: function  (event)
	{
		var textbox = document.getElementById ("listTextbox");
		if(textbox.value.length < 2){
			alert("Input too short");
			return;
		}
		var listBox = document.getElementById ("listBox");
		listBox.appendChild (bpopt.newListItem (textbox.value, textbox.value));
	},


	listEditOnCommand: function  (event)
	{
		var listBox = document.getElementById ("listBox");
		if (listBox.selectedItem == null)
			return;
		var listcell = listBox.selectedItem.childNodes.item (0);
		var inout = { value: listcell.getAttribute ("value") };
		bpopt.prompts.prompt(window, "", "", inout, null, { value: false });
		if(inout.value.length < 2){
			alert("Input too short");
			return;
		}
		listcell.setAttribute ("label", inout.value);
		listcell.setAttribute ("value", inout.value);
	},


	listRemoveOnCommand: function  (event)
	{
		document.getElementById ("listRemove").setAttribute ("disabled", true);
		var listBox = document.getElementById ("listBox");
		if (listBox.selectedItem != null)
			listBox.removeChild (listBox.selectedItem);
	},


	keyDelCookie: function (event)
	{
		if (event.keyCode == 46)
			bpriv.DeleteLso();
	},







};