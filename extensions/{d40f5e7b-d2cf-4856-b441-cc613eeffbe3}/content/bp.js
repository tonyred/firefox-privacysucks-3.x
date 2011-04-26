


var bprivShutDownObserver = {


	   QueryInterface: function(aIID) {
	      if (aIID.equals(Components.interfaces.nsIWebProgressListener)   ||
	          aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
	          aIID.equals(Components.interfaces.nsISupports))
	               return this;
	      throw Components.results.NS_NOINTERFACE;
	   },


		register: function()
		{
		    var observerService = Components.classes["@mozilla.org/observer-service;1"]
		                          .getService(Components.interfaces.nsIObserverService);
		    observerService.addObserver(this, "quit-application-requested", false);
			//note: "quit-application-granted" sends no data value to determine if restart or shutdown
			//note: "quit-application-granted" is UNRELIABLE since not triggered by closing a window with x (upper right window corner)
			//note: "quit-application" is not triggered at all
		},

		observe: function(aSubject, aTopic, aData)
		{
		//	alert(aTopic+'   '+aData);
			if(aTopic == "quit-application-requested")
				bpriv.onexit();
		},


};





var bpriv = {
	prompts: Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService),
	wm: Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator),
	prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.bprivacy."),
	mw: window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
		                   .getInterface(Components.interfaces.nsIWebNavigation)
		                   .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
		                   .rootTreeItem
		                   .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
		                   .getInterface(Components.interfaces.nsIDOMWindow),
	nsIFilePicker: Components.interfaces.nsIFilePicker,
	lsos: [],
	Stack: [],
	timerID: 0,
	tStart: null,
	tTicks: null,
	selected: null,
	Scan: 0,


	LOG: function(text)
	{
	    var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
	    consoleService.logStringMessage(text);
	},


	WindowOnEnter: function(event) {
	    if (event.keyCode == 13) { return false; }
	    return true;
	},


	openHelp: function()
	{
		if(gBrowser)
			gBrowser.selectedTab = gBrowser.addTab('chrome://bp/content/BetterPrivacy.html');
	},


	getDoc: function()
	{
		var doc = bpriv.mw.document;
		if(!doc)
			doc = window.document;
		return doc;
	},




	convert: function()
	{
		var PrefSrv = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		//AutoDelLSO
		try{
			if(bputils.prefs.getBoolPref("extensions.bprivacy.AutoDelLSO") == false)
				bputils.setPref("extensions.bprivacy.AutoDelLSOnExitMode", 1);
			PrefSrv.clearUserPref("extensions.bprivacy.AutoDelLSO"); //delete preference
		}catch(e){}
		//FlashAppDir
		try{
			if(bputils.prefs.getCharPref("extensions.bprivacy.flashAppDir") && String(bputils.prefs.getCharPref("extensions.bprivacy.flashAppDir")).length)
			{
				var Dir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	  			Dir.initWithPath(bputils.getPref("extensions.bprivacy.flashAppDir"));
		  		if(Dir.path && Dir.exists() && Dir.isDirectory())
					bpriv.prefs.setComplexValue("DataDir", Components.interfaces.nsILocalFile, Dir);
			}
			PrefSrv.clearUserPref("extensions.bprivacy.flashAppDir"); //delete preference
		}catch(e){}
		//DOMStorage
		try{
			if(bputils.prefs.getBoolPref("extensions.bprivacy.domstorage.allowed") == false )
			{
				bputils.setPref("extensions.bprivacy.domclear", true);
				bputils.setPref("dom.storage.enabled", true);
				PrefSrv.clearUserPref("extensions.bprivacy.domstorage.allowed"); //delete preference
			}
		}catch(e){}



		//ProtectionList
		try{
			if(bputils.getPref("extensions.bprivacy.protectedLSOList").length )
			{
				var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
				str.data = bputils.getPref("extensions.bprivacy.protectedLSOList");
				bpriv.prefs.setComplexValue("Exclusions", Components.interfaces.nsISupportsString, str);
				PrefSrv.clearUserPref("extensions.bprivacy.protectedLSOList"); //delete preference
			}
		}catch(e){}


	},



	//startup of FireFox
	firstload: function(event)
	{
		try{
                        window.removeEventListener("load", bpriv.firstload, true);
        		bpriv.convert();
        		bprivShutDownObserver.register();


        		if(!bputils.getPref("extensions.bprivacy.initiated"))
        		{
        			bputils.setPref("extensions.bprivacy.initiated", true);
        			bputils.setPref("browser.send_pings", false);
        			bputils.setPref("extensions.bprivacy.sendpings.allowed", false);
        			bpriv.GetFlashDir(2);//set flashApp directory preference, scan if necessary
        			setTimeout("bpriv.openHelp()", 25000);
        		}else
        		{
        			if(bputils.getPref("extensions.bprivacy.alwaysReScan") || !bpriv.GetFlashDir(0))
        				bpriv.GetFlashDir(1);
        		}
        		if(
        			( !bputils.getPref("extensions.bprivacy.sendpings.allowed") && (bputils.getPref("extensions.bprivacy.sendpings.allowed") != bputils.getPref("browser.send_pings")) )
        		)
        		{
        			//if(confirm("BetterPrivacy:\r\nThe extension detected that one or more privacy settings have been modified!\r\nPress OK to correct those values.")){
        				bputils.setPref("browser.send_pings", bputils.getPref("extensions.bprivacy.sendpings.allowed"));
        			//}
        		}
        		if(bputils.getPref("extensions.bprivacy.DelTimerInterval") < 1)
        			bputils.setPref("extensions.bprivacy.DelTimerInterval", 1);

        		if(window == bpriv.mw)
        		{
        			if(bputils.getPref("extensions.bprivacy.domclear")){
        				bpriv.DelDOM("startup");
        			}//AutoDelDOM
        			if(bputils.getPref("extensions.bprivacy.AutoDelLSOnStart"))
        				bpriv.prepareDelLSO(2, null);
        			bpriv.startDelTimer();
        		}
        		bpriv.SetKeys();
		}catch(e){alert("An error occured while initializing BetterPrivacy\r\nPlease send the following information to the author: \r\n"+e);}
	},//end menue load






	SetKeys: function()
	{
		var kNode = document.getElementById("key_bp");
		if(kNode)
		{
			var keyCode = bputils.getPref("extensions.bprivacy.keycode");
			if(keyCode){
				kNode.setAttribute("disabled", false);
				kNode.setAttribute("modifiers", String(bputils.getPref("extensions.bprivacy.keymodifiers")));
				kNode.setAttribute("key", String.fromCharCode(keyCode));
			}
		}
	},





	GetDirs: function(currentDir, dirArray)
	{
		var entries;
		try{
			entries = currentDir.directoryEntries;
		}catch(e){}
		while(entries && entries.hasMoreElements())
		{
			var entry = entries.getNext();
			try{
				entry.QueryInterface(Components.interfaces.nsIFile);
				if (entry.isDirectory() && !entry.isSymlink() && !bpriv.isSpecial(entry))
				{
					dirArray.push(entry);
					bpriv.GetDirs(entry, dirArray);
				}
			}catch(e){bpriv.LOG("BetterPrivacy: Failure parsing directories - " + e);}
		}
		return dirArray;
	},




	DelDirSortAlgo: function(file1, file2)
	{
		if (file1.path.length > file2.path.length)
		return -1;
		else if (file2.path.length > file1.path.length)
		return 1;
		return 0;
	},



	delDirs: function(FlashDirRoot)
	{
		if(!FlashDirRoot || !bputils.getPref("extensions.bprivacy.delDirs"))
			return;
	  	// Delete ISO8601 formated directories
		var dirArray = new Array();
		bpriv.GetDirs(FlashDirRoot, dirArray);
		var numDirsToDelete = dirArray.length;
		dirArray.sort(bpriv.DelDirSortAlgo);
		for(var i=0; i<numDirsToDelete; i++)
		{
			try{ //never delete non-empty directories (FF throws NS_ERROR_FILE_DIR_NOT_EMPTY if remove attribut is false)
				dirArray[i].remove(false);
			}catch(e)
			{
				if(e.name != "NS_ERROR_FILE_DIR_NOT_EMPTY")
					bpriv.LOG("BetterPrivacy: Unable to delete directory (usually temporarily due to an open handle or missing permission)- " + dirArray[i].path);      // + " - " + e
			}
		}
		dirArray = null;
	},



	onexit: function(event)
	{
                var time = bpriv.tStart ? bpriv.tStart : "";
                bputils.setPref("extensions.bprivacy.timer", time);

		////try{bpriv.mw.removeEventListener("unload", bpriv.onexit, false);}catch(e){}
		try{
			bpriv.mw.clearTimeout(bpriv.timerID);
			var enumerator = bpriv.wm.getEnumerator("navigator:browser");
		var wincount = 0;
		while(enumerator && enumerator.hasMoreElements()){
			wincount++;
			enumerator.getNext();
		}

		if(wincount == 1){
			if(bputils.getPref("extensions.bprivacy.domclear")){
				bpriv.DelDOM("shutdown");
			}//AutoDelDOM
			bpriv.prepareDelLSO(3, null);
		}

		}catch(e){alert("BetterPrivacy\r\nError in shutdown procedure\r\nPlease report this to the author " + e);}
        	//When a string is assigned to the returnValue property of window.event, a dialog box appears....
        	//the problem seems to be:
        	//1. when onbeforeunload is called, it will take the return value of the handler as window.event.returnValue.
        	//2. it will then parse the return value as a string (unless it is null)
        	//3. since false is parsed as a string, the dialogue box will fire, which will then pass an appropriate true/false
        	//the result is, there doesn't seem to be a way of assigning false to onbeforeunload, to prevent it from the default dialog.
	},






	DelDOM: function(inf)
	{
                var FFVersion = Components.classes["@mozilla.org/xre/app-info;1"]
                        .getService(Components.interfaces.nsIXULAppInfo).version;
                if (parseInt(FFVersion.charAt(0)) > 3)
                        return;
		var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
		file.append("webappsstore.sqlite");
		if(file.exists()) // if it exists, delete
		{
                      try{
                        file.remove(false);
                      }catch(e){
                        bpriv.LOG("BetterPrivacy: Deletion of DOM data on " + inf + " impossible due to open handle - trying again later.");
                      }
		}
	},


	checkFlashFolder: function()
	{
		if (!bpriv.GetFlashDir(0))
		{
			if (!bputils.getPref("extensions.bprivacy.donotaskforfolder"))
			{
				check = {value: false};
				var confirmed = bpriv.prompts.confirmCheck(window, "BetterPrivacy", bpriv.getString("askfornewpath"), bpriv.getString("askfornewpath2"), check);
				bputils.setPref("extensions.bprivacy.donotaskforfolder", check.value);
				if(confirmed)
					window.openDialog('chrome://bp/content/bp.xul', '_blank', 'chrome=yes, modal=yes, resizable=yes, centerscreen=yes');
			}
		}
		return bpriv.GetFlashDir(0);
	},


	isDefaultLSO: function(lso)
	{
                var DefaultLSORegEx = bputils.getPref("extensions.bprivacy.DefaultLSORegEx") + "(\u005c\u002f|\u005c\u005c)?$";
		var rgx_def = new RegExp(DefaultLSORegEx, 'i');
		var DefaultLSOName = new RegExp(bputils.getPref("extensions.bprivacy.DefaultLSOName"), 'i');
		var dir = String(lso.path).replace(DefaultLSOName, "");
		if( lso.file.leafName.match(DefaultLSOName) && dir.match(rgx_def) )
		      return true;
		return false;
	},


	isSettingsLSO: function(lso)
	{
                var SettingsLSORegEx = bputils.getPref("extensions.bprivacy.DefaultLSORegEx") + "(\u005c\u002f|\u005c\u005c).+";
		var rgx_def = new RegExp(SettingsLSORegEx, 'i');
		var dir = String(lso.path);
		if( dir.match(rgx_def) )
		      return true;
		return false;
	},


	isProtectedLSO: function(lso)
	{
		if(String(lso.prot).indexOf("d") >= 0 || String(lso.prot).indexOf("s") >= 0)
			return true;
		return false;
	},


	LSOtoDelete: function()
	{
		bpriv.lsos = [];
		if(!bpriv.checkFlashFolder())
			return 0;

		bpriv.LoadLsos(bpriv.GetFlashDir(0), true);
		var deleted = 0;
		//var rgx_def = new RegExp(bputils.getPref("extensions.bprivacy.DefaultLSORegEx"), 'i');
		//rgx_def += "(\u005c\u002f|\u005c\u005c)?$";
		//var DefaultLSOName = new RegExp(bputils.getPref("extensions.bprivacy.DefaultLSOName"), 'i');
		for (var x=0;x<bpriv.lsos.length;x++)//first check number of LSO's to be deleted
		{
			try{
				var defaultCookie = bpriv.isDefaultLSO(bpriv.lsos[x]);
				var protectedCookie = bpriv.isProtectedLSO(bpriv.lsos[x]);
				//if(String(bpriv.lsos[x].prot).indexOf("d") >= 0 || String(bpriv.lsos[x].prot).indexOf("s") >= 0)
				//	protectedCookie = true;
				//var dir = String(bpriv.lsos[x].path).replace(DefaultLSOName, "");
				//if( bpriv.lsos[x].file.leafName.match(DefaultLSOName) && dir.match(rgx_def) )
				//	defaultCookie = true;
				if(!protectedCookie && (!defaultCookie || bputils.getPref("extensions.bprivacy.DefaultFlashCookieDeletion")))
					deleted++;
			}catch(e){bpriv.LOG("BetterPrivacy: Error while counting LSOs");}
		}
		return deleted;

	},




	prepareDelLSO: function(mode, trange)  //mode 1=byTimer 2=onStartup 3=onExit
	{
		try{
			if(mode == 3)
			{
				if(bputils.getPref("extensions.bprivacy.AutoDelLSOnExitMode") == 0)
				{
					if(!bputils.getPref("extensions.bprivacy.donotaskonexit"))
					{
						window.openDialog("chrome://bp/content/progress.xul", "_blank", "chrome=yes, modal=yes, resizable=no, centerscreen=yes, alwaysRaised=yes", mode);
					}else
					{
						if(bpriv.LSOtoDelete())
							bpriv.DelLSO(mode, trange);
					}
				}
				else if(bputils.getPref("extensions.bprivacy.AutoDelLSOnExitMode") == 1)
				{
						if(!bputils.getPref("privacy.sanitize.sanitizeOnShutdown"))
							return;
						if(!bputils.getPref("privacy.item.extensions-betterprivacy") && !bputils.getPref("privacy.cpd.extensions-betterprivacy"))
							return;
						if(bpriv.LSOtoDelete())
							bpriv.DelLSO(mode, trange);
				}
			}else
			{
				if(bpriv.LSOtoDelete())
					bpriv.DelLSO(mode, trange);
			}
		}catch(e){alert("BetterPrivacy: Error in prepare delete LSO function: " + e);}
	},





	processProgressWindow: function(win, mode) //always mode 3
	{
		var deleted = bpriv.LSOtoDelete();
		if(deleted)
		{
			check = {value: false};
			var delconfirmed = bpriv.prompts.confirmCheck(window, bpriv.getString("askfordeletion1"), bpriv.getString("askfordeletion2") + " " + deleted + " " + bpriv.getString("askfordeletion3"), bpriv.getString("askfordeletion4"), check);
			bputils.setPref("extensions.bprivacy.donotaskonexit", check.value);
			if(delconfirmed)
				bpriv.DelLSO(mode, null);
		}
		win.close();//keep open until here, else the processing might be aborted before finishing
	},


	DelLSO: function(mode, range)//mode 0=ClearHistory 1=byTimer 2=onStartup 3=onExit
	{
		try{
			deleted = 0;
			var DefaultLSOName = new RegExp(bputils.getPref("extensions.bprivacy.DefaultLSOName"), 'i');
			for (var x=0;x<bpriv.lsos.length;x++)//effectively delete LSO's
			{
        			try{
        				var defaultCookie = bpriv.isDefaultLSO(bpriv.lsos[x]);
        				var protectedCookie = bpriv.isProtectedLSO(bpriv.lsos[x]);
        				var dir = String(bpriv.lsos[x].path).replace(DefaultLSOName, "");
        				if(!protectedCookie && (!defaultCookie || bputils.getPref("extensions.bprivacy.DefaultFlashCookieDeletion")))
        				{
        						var cDate = new Date();
        						if( mode == 1 && bputils.getPref("extensions.bprivacy.useDelTimerDelay") && cDate.getTime() >= bpriv.lsos[x].file.lastModifiedTime && cDate.getTime()-bpriv.lsos[x].file.lastModifiedTime < bputils.getPref("extensions.bprivacy.DelTimerInterval") * 1000 )
        							continue;
        						if( mode == 0 && range && cDate.getTime() >= bpriv.lsos[x].file.lastModifiedTime && cDate.getTime()-bpriv.lsos[x].file.lastModifiedTime > range )
        							continue;
        						bpriv.lsos[x].file.remove(false);
        						deleted++;
        				}
        			}catch(e){bpriv.LOG("BetterPrivacy: Error while deleting LSO");}
			}
			bputils.setPref("extensions.bprivacy.removed", bputils.getPref("extensions.bprivacy.removed") + deleted);//statistics
			bputils.setPref("extensions.bprivacy.removedSession", bputils.getPref("extensions.bprivacy.removedSession") + deleted);//statistics
			bpriv.delDirs(bpriv.GetFlashDir(0)); //remove folders
			bpriv.updateKnownLSOs();
		}catch(e){alert("BetterPrivacy: Error in delete LSO function: " + e);}
	},


	updateKnownLSOs: function()
	{
		if(bpriv.lsos)
			bputils.setPref("extensions.bprivacy.LSOcount", bpriv.lsos.length);
	},




	modifiedSince: function(lso)
	{
		var c = new Date(); //will hold current ticks
		var m = new Date();
		m.setTime(parseInt(lso.modified)); //modified lso ticks
		var diff = c.getTime() - m.getTime();
		return diff;
	},


	startDelTimer: function()
	{
              var tCurrent = new Date();
              bpriv.tStart = new Date();
              var Timer = bputils.getPref("extensions.bprivacy.timer");
              if(Timer){
               var tTimer = new Date(Timer);
                     if(tTimer < tCurrent)
                          bpriv.tStart = tTimer;
              }
              bpriv.updateDelTimer(true);
	},




        updateDelTimer: function(initiated)
        {
                if(bputils.getPref("extensions.bprivacy.NotifyOnNewLSO"))
        	{
                      if (FlashDirRoot = bpriv.GetFlashDir(0))
                      {
                        bpriv.lsos = [];
                        bpriv.LoadLsos(FlashDirRoot, false);
                        if(!initiated && bputils.getPref("extensions.bprivacy.NotifyOnNewLSO") == 1 && bpriv.lsos.length > bputils.getPref("extensions.bprivacy.LSOcount"))
                        {
                          var count = bpriv.lsos.length - bputils.getPref("extensions.bprivacy.LSOcount");
                          var str = count > 1 ? " LSO's have" : " LSO has";
                          var message = "BetterPrivacy detected that " + count + str + " been placed on your harddisk!";
                          bpriv.NotifyNewLSO(bpriv.hashString(message), message);
                        }else
                          bputils.setPref("extensions.bprivacy.NotifyOnNewLSO", 1);
                        bpriv.updateKnownLSOs();
                      }
        	}
        	if(bpriv.timerID)
        	       clearTimeout(bpriv.timerID);
        	if(bputils.getPref("extensions.bprivacy.useDelTimer"))
                {
                        if(!bpriv.tStart)
                          bpriv.tStart = new Date();
                        var tDate = new Date();
                        tDate.setTime(tDate.getTime() - bpriv.tStart.getTime());
                        if(tDate.getTime() / (bputils.getPref("extensions.bprivacy.DelTimerInterval") * 1000) >= 1){
                          bpriv.prepareDelLSO(1, null);
                          bpriv.tStart = null;
                        }
        	} else {
                        bpriv.tStart = null;
        	}
        	bpriv.timerID = setTimeout("bpriv.updateDelTimer()", 1000);
	},


	sortMultiDimensional: function (a,b)
	{
	    // this sorts the array using the second element
	    return ((a[1] < b[1]) ? -1 : ((a[1] > b[1]) ? 1 : 0));
	},


	NotifyNewLSO: function(value, message)
	{
		var c = new Date();
		var mins = c.getMinutes();
		if(mins < 10)
			mins = "0" + mins;
		var secs = c.getSeconds();
		if(secs < 10)
			secs = "0" + secs;
		var ModifiedLSOs = "    Timestamp: " + c.getHours() + ":" + mins + ":" + secs;
		var count = 0;
		for (var x=0;x<bpriv.lsos.length;x++)
		{
			if(bpriv.modifiedSince(bpriv.lsos[x]) < 2000)
			{
				if(!count)
					ModifiedLSOs += '    Last modified:';
				ModifiedLSOs += ' "' + bpriv.lsos[x].file.leafName + '"';
				count++;
			}
		}
		bpriv.Notification(value, message + ModifiedLSOs);
	},



	Notification: function(value, message)
	{
	  var buttons = [{ label: "View LSOs",
	                     callback: function() { bpriv.RemoveNotification(value); bpriv.showBetterPrivacy(); },
	                     accessKey: null, popup: null }];
	  var nbox = window.getBrowser().getNotificationBox();
		nbox.appendNotification(message, value, "chrome://bp/content/pie.png", bputils.getPref("extensions.bprivacy.NotifyPriority"), buttons);
		if(bputils.getPref("extensions.bprivacy.NotifyDuration"))
			setTimeout(function(){bpriv.RemoveNotification(value)}, bputils.getPref("extensions.bprivacy.NotifyDuration") * 1000, value);
	},


	RemoveNotification: function(value)
	{
		if(item = window.getBrowser().getNotificationBox().getNotificationWithValue(value))
			window.getBrowser().getNotificationBox().removeNotification(item);
	},


	changeAppDir: function(event)
	{
		bpriv.Scan = -1;
		if (event)
		{
			if (event.keyCode != 13)
				return;
			var newpath = bpriv.getDoc().getElementById("appdir").value;

			var oldDir;
			try{
				oldDir = bpriv.prefs.getComplexValue("DataDir", Components.interfaces.nsILocalFile);
			}catch(e){}

			if (oldDir && newpath == oldDir.path)
				return;
			if(!confirm("You changed the FlashApplication folder to: \r\n" + newpath + "\r\nDo you want to apply this modification?"))
			{
				if (oldDir)
					newpath = oldDir.path;
				else
					newpath = "";
				bpriv.getDoc().getElementById("appdir").value = newpath;
			}
			var Dir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			try{
	  			Dir.initWithPath(newpath);
				newpath = Dir;
		  		if(!Dir.path || !Dir.exists() || !Dir.isDirectory())
					newpath = null;
			}catch(e){newpath = null;}
		}else
		{
			var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(bpriv.nsIFilePicker);
			fp.init(window, bpriv.getString("selectDirTitle"), bpriv.nsIFilePicker.modeGetFolder);
			var rv = fp.show();
			if ((rv != bpriv.nsIFilePicker.returnOK) && (rv != bpriv.nsIFilePicker.returnReplace))
				return;
			var newpath = fp.file;
		}
		if(newpath)
			bpriv.prefs.setComplexValue("DataDir", Components.interfaces.nsILocalFile, newpath);
		bpriv.LSOTreeShow(newpath);
		return true;
	},



	searchDir: function()
	{

		if(bpriv.getDoc().getElementById("searchFolderID").label != bpriv.getString("abort")){
			if(FlashDir = bpriv.GetFlashDir(2))
				bpriv.LSOTreeShow(FlashDir);
		}else{
			bpriv.Scan = -1;
		}
	},



	treeView:
	{
		treeBox: null,
		selection: null,
		get rowCount()                       { return bpriv.lsos.length; },
		setTree: function(treeBox)         { this.treeBox = treeBox; },
		isSeparator: function(idx)         { return false; },
		isSorted: function()               { return false; },
		isEditable: function(idx, column)  { return false; },
		getCellProperties: function(idx, column, prop) {},
		getColumnProperties: function(column, element, prop) {},
		getRowProperties: function(row, element, prop) {},
		getImageSrc: function() {return null;},
		isContainer: function() {return false;},
		cycleHeader: function() {},
 		getCellText: function(idx, column)
		{
			if(!bpriv.lsos.length)
				return "";
			//else if (column.id=="folder")
			else if (column.id=="ident")
				return bpriv.lsos[idx].ident;
			else if (column.id=="name")
				return bpriv.lsos[idx].file.leafName;
			else if (column.id=="size")
				return bpriv.lsos[idx].size;
			else if (column.id=="modified")
			{
				var cDate = new Date();
				cDate.setTime(parseInt(bpriv.lsos[idx].modified));
				return cDate.toLocaleString();
			}
			else if (column.id=="prot")
			{
				if(bpriv.lsos[idx].prot.indexOf("d") < 0 && bpriv.lsos[idx].prot.indexOf("s") < 0)
					return bpriv.getString("unprotected");
				else if(bpriv.lsos[idx].prot.indexOf("d") >= 0)
					return bpriv.getString("protectedFolder");
				else if(bpriv.lsos[idx].prot.indexOf("s") >= 0)
					return bpriv.getString("protectedSubFolder");
			}
			return "";
		},
	},




	LSOTreeShow: function(flashDir)
	{
		var cDate = new Date();
		if (!flashDir)
		{
			// Display error if selected directory does not exist
			bpriv.getDoc().getElementById("appdir").setAttribute ("readonly","true");
			bpriv.getDoc().getElementById("appdir").value = bpriv.getString("dirNotFound");
			bpriv.getDoc().getElementById("appdir").style.backgroundColor = "red";
			bpriv.getDoc().getElementById("appdir").style.color = "white";
			bpriv.getDoc().getElementById("searchFolderID").label = bpriv.getString("searchFlashFolder");
			bpriv.getDoc().getElementById("lsoinfo").value = "";
			bpriv.getDoc().getElementById("tip").value = "Status " + cDate.toLocaleString();
		}
		else
		{
			bpriv.getDoc().getElementById("appdir").removeAttribute("readonly");
			bpriv.getDoc().getElementById("appdir").value = flashDir.path;
			bpriv.getDoc().getElementById("appdir").style.backgroundColor = "";
			bpriv.getDoc().getElementById("appdir").style.color = "";
			bpriv.getDoc().getElementById("searchFolderID").label = bpriv.getString("searchFlashFolder");
			bpriv.getDoc().getElementById("lsoinfo").value = bpriv.getString("listLSOs");
			bpriv.getDoc().getElementById("tip").value = "Status " + cDate.toLocaleString();
		}
		setTimeout(function(){bpriv.LoadLsosIntoTree(flashDir);}, 500, flashDir); //provide time to update GUI
	},



	LoadLsosIntoTree: function(flashDir)
	{

		bpriv.lsos = [];
		if (flashDir)
			bpriv.LoadLsos(flashDir, true);
		//bpriv.updateGUI(flashDir, true);
		//bpriv.TreeOnSelect(flashDir);
                bpriv.updateGUI(true, true);
                bpriv.TreeOnSelect();
	},



	ReloadLsos: function()
	{
		bpriv.LSOTreeShow(bpriv.GetFlashDir(0));
	},


	//updateGUI: function(flashDir, sort)
	updateGUI: function(sort, view)
	{
		var LSOTree = bpriv.getDoc().getElementById("LSOViewerTree");
		if(!LSOTree)
			return;
		if (view)
		      LSOTree.view = bpriv.treeView;
		bpriv.updateKnownLSOs();
		bpriv.getDoc().getElementById("lso_removed").value = bputils.getPref("extensions.bprivacy.removed");
		bpriv.getDoc().getElementById("lso_removedSession").value = bputils.getPref("extensions.bprivacy.removedSession");
		bpriv.getDoc().getElementById("removeAllLsos").disabled = bpriv.lsos.length == 0;
		bpriv.getDoc().getElementById("lsoinfo").value = "";
		if(sort)
			bpriv.SortLSOView(null);
		else
			LSOTree.treeBoxObject.invalidate();
	},


	TreeOnSelect: function()
	{
		var LSOTree = bpriv.getDoc().getElementById("LSOViewerTree");
		if(!LSOTree)
			return;
		//LSOTree.view = bpriv.treeView;
		if (/*!bpriv.lsos.length ||*/ LSOTree.currentIndex < 0 || !bpriv.lsos[LSOTree.currentIndex])
		{
			bpriv.getDoc().getElementById("FullPathID").value = bpriv.getString("nothingselected");
			bpriv.getDoc().getElementById("protectLsoDir").label = bpriv.getString("protectDir");
			bpriv.getDoc().getElementById("removeLso").disabled = true;
			bpriv.getDoc().getElementById("protectLsoDir").disabled = true;
			return;
		}
		//save selection
		bpriv.selected = bpriv.lsos[LSOTree.currentIndex].path;
		bpriv.getDoc().getElementById("removeLso").removeAttribute("disabled");
		bpriv.getDoc().getElementById("protectLsoDir").removeAttribute("disabled");
		bpriv.getDoc().getElementById("FullPathID").value = bpriv.lsos[LSOTree.currentIndex].path;
		if(bpriv.lsos[LSOTree.currentIndex].prot.indexOf("d") >= 0)
			bpriv.getDoc().getElementById("protectLsoDir").label = bpriv.getString("unprotectDir");
		else
			bpriv.getDoc().getElementById("protectLsoDir").label = bpriv.getString("protectDir");
	},


	getLSOProtection: function(entry)
	{
		var exp = new RegExp(entry.leafName, 'i');
		var dir = entry.path.replace(exp, "");
		dir = dir.replace(/[\\\/]$/i, "").toLowerCase();

		var prot = "";
		var protListarr = bpriv.prefs.getComplexValue("Exclusions", Components.interfaces.nsISupportsString).data.split("|");


		var exp = new RegExp('^.*'+bputils.getPref("extensions.bprivacy.FlashDirRegEx")+'(\u005c\u002f|\u005c\u005c)', 'i');
		if(bputils.getPref("extensions.bprivacy.alwaysReScan"))
			dir = dir.replace(exp, "");
		for (var x=0;x<protListarr.length;x++)
		{
			if(!String(protListarr[x]).length)
				continue;
			var protdir = protListarr[x].toLowerCase();
			if(bputils.getPref("extensions.bprivacy.alwaysReScan"))
				protdir = protdir.replace(exp, "");
			if(dir == protdir){
				prot = "d";
				break;
			}else if(bputils.getPref("extensions.bprivacy.autosubfolders") && dir.indexOf(protdir) >= 0){
				prot = "s";
			}
		}
		return prot;
	},



	RefreshLSOProtection: function()
	{
		for (var i=0; i<bpriv.lsos.length; i++)
			bpriv.lsos[i].prot = bpriv.getLSOProtection(bpriv.lsos[i].file);
	},




	LoadLsos: function(currentDir, doFootprint)
	{
		var protListarr = bpriv.prefs.getComplexValue("Exclusions", Components.interfaces.nsISupportsString).data.split("|");
		var entries;
		try{
                        entries = currentDir.directoryEntries;
		}catch(e){}
		if(!entries)
			bpriv.LOG("BetterPrivacy Warning: A LSO folder is inaccessable: " + currentDir.path);
		var rgx_dir = new RegExp('^.*'+bputils.getPref("extensions.bprivacy.FlashDirRegEx"), 'i');
                var DefaultLSORegEx = bputils.getPref("extensions.bprivacy.DefaultLSORegEx") + "(\u005c\u002f|\u005c\u005c)?$";
		var rgx_def = new RegExp(DefaultLSORegEx, 'i');
		while(entries && entries.hasMoreElements())
		{
			try{
				var entry = entries.getNext();
				entry.QueryInterface(Components.interfaces.nsIFile);
				if (entry.isFile() && !entry.isSymlink() && !bpriv.isSpecial(entry))
				{
					try{
						if (bpriv.isLSO(entry, doFootprint))
						{
							var cDate = new Date();
							var ticks = cDate.getTime();
							var modified = ticks-entry.lastModifiedTime;
							var prot = bpriv.getLSOProtection(entry);
							var ident = entry.path.replace(rgx_dir, "");
                                                        ident = String(ident).replace(rgx_def, "");
							ident = String(ident).match(/[^\\\/]+\.[^\\\/]+/, "");
							ident = String(ident).replace(/^[#]/, "");
							bpriv.lsos[bpriv.lsos.length] = new bpriv.Lso( entry, ident, entry.fileSize, entry.path, prot, String(ticks - modified));
						}
					}catch(e){bpriv.LOG("BetterPrivacy: An error occured while scanning folders for LSO data: " + e);}
				}
				else if (entry.isDirectory() && !entry.isSymlink() && !bpriv.isSpecial(entry)){
					bpriv.LoadLsos(entry, doFootprint);
				}
			}catch(e){bpriv.LOG("BetterPrivacy: Error while scanning folders for LSO data" + e);}
		}
		protListarr = null;
	},




	Lso: function(entry, ident, size, path, prot, modified)
	{
		this.file = entry;
		this.ident = ident;
		this.name = entry.leafName;
		this.size = size;
		this.path = path;
		this.prot = prot;
		this.modified = modified;

                if (bpriv.isDefaultLSO(this))
                        this.ident = "<default LSO>";
                else if (bpriv.isSettingsLSO(this))
                        this.ident = ident + " <settings LSO>";
                else if (ident.substring(ident.length-4) === ".sol")
                        this.ident = "<local LSO>";

		return this;
	},


	isLSO: function(item, doFootprint)
	{
		var str;
		var dotIndex  = item.leafName.lastIndexOf('.');
		var extension = (dotIndex >= 0) ? item.leafName.substring(dotIndex+1) : "";
		if(extension.toLowerCase() != bputils.getPref("extensions.bprivacy.LSOExtension").toLowerCase())
		      return false;
		if(doFootprint)
		{
			var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			try{
                		file.initWithPath(item.path);
                		if (file.exists())
                		{
                			var hfp = bputils.getPref("extensions.bprivacy.LSOHexFootprint").split("|");//get hexfootprint
                			var istream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
                			var bstream = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(Components.interfaces.nsIBinaryInputStream);
                			try{
                			   istream.init(file, -1, -1, false);
                			   bstream.setInputStream(istream);
                			   str = String(bstream.readBytes(bstream.available() > hfp.length ? hfp.length : bstream.available()));//only read needed bytes
                			}catch(e){bpriv.LOG("BetterPrivacy: HexFootPrint error 1 " + e); return false;}
                			bstream.close();
                			istream.close();
                			if(str && str.length >= hfp.length)
                			{
                			   for (var i = 0; i < hfp.length; i++) {
                                                if(hfp[i].length && str.charCodeAt(i) != hfp[i]) //compare
                                                return false;
                			    }
                			}else return false;
                		}
			}catch(e){bpriv.LOG("BetterPrivacy: HexFootPrint error 2 " + e); return false;}
		}
		return true;
	},





	FindLSORoot: function(HomeDir, ExToFind)
	{
		if(bpriv.Stack.length > 0)
			return; //important
		bpriv.Stack[0] = HomeDir;
		bpriv.Scan = 1;
		bpriv.FindLSORootNonRecursive( ExToFind, 1);
	},


	FindLSORootNonRecursive: function(ExToFind,  done)
	{
		var finish = function(newdir){
			bpriv.LSOTreeShow(newdir);
			bpriv.Scan = 0;
			bpriv.Stack = [];
		}
		var currentDir = bpriv.Stack.pop();
		if (ExToFind.test(currentDir.leafName))
		{
			var Dir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			try{
	  			Dir.initWithPath(currentDir.path);
		  		if(Dir.path && Dir.exists() && Dir.isDirectory())
					bpriv.prefs.setComplexValue("DataDir", Components.interfaces.nsILocalFile, Dir);
				else
					Dir = null;
			}catch(e){Dir = null;}

			finish(Dir);
			return;
		}
		done++;
		var entries;
		try{
			entries = currentDir.directoryEntries;
		}catch(e){}
		while(entries && entries.hasMoreElements() && bpriv.Scan > 0)
		{
			var entry = entries.getNext();
			entry.QueryInterface(Components.interfaces.nsIFile);
			if (entry.isDirectory() && !entry.isSymlink() && !bpriv.isSpecial(entry))
				bpriv.Stack.push(entry);
		}
 		if(bpriv.Scan > 0 && bpriv.Stack.length > 0){
			//GUI
			if(bpriv.getDoc().getElementById("lsoinfo"))
				bpriv.getDoc().getElementById("lsoinfo").value = bpriv.getString("LSOFolderScan") + " ["+done+"]";
			if(bpriv.getDoc().getElementById("searchFolderID"))
				bpriv.getDoc().getElementById("searchFolderID").label = bpriv.getString("abort");
			//GUI-end
			setTimeout( function(){bpriv.FindLSORootNonRecursive( ExToFind, done)}, 1, ExToFind, done);
		}else{
			if(bpriv.Scan > 0 && bpriv.getDoc().getElementById("lsoinfo"))
				bpriv.getDoc().getElementById("lsoinfo").value = bpriv.getString("NoDirFound");
			finish(bpriv.GetFlashDir(0));
		}
	},



	isSpecial: function(entry)
	{
		try{
			return entry.isSpecial();
		}catch(e){}
		return false; //no avail on Mac
	},



	RemoveFromLSOProtection: function(path)
	{
		var exp = new RegExp('^.*'+bputils.getPref("extensions.bprivacy.FlashDirRegEx")+'(\u005c\u002f|\u005c\u005c)', 'i');
		if(bputils.getPref("extensions.bprivacy.alwaysReScan"))
			path = path.replace(exp, "");

		var protListarr = bpriv.prefs.getComplexValue("Exclusions", Components.interfaces.nsISupportsString).data.split("|");
		for (var x=0;x<protListarr.length;x++)
		{
			var dir = protListarr[x];
			if(bputils.getPref("extensions.bprivacy.alwaysReScan"))
				dir = dir.replace(exp, "");
			if(dir.toLowerCase() == path.toLowerCase())
				protListarr.splice(x, 1);
		}

		var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
		str.data = protListarr.join("|");
		bpriv.prefs.setComplexValue("Exclusions", Components.interfaces.nsISupportsString, str);
		protListarr = null;
	},



	AddToLSOProtection: function(path)
	{
		var protListarr = bpriv.prefs.getComplexValue("Exclusions", Components.interfaces.nsISupportsString).data.split("|");
		for (var x=0;x<protListarr.length;x++)
		{
			if(protListarr[x].toLowerCase() == path.toLowerCase()){
				protListarr = null;
				return;
			}
		}
		protListarr.push(path);
		var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
		str.data = protListarr.join("|");
		bpriv.prefs.setComplexValue("Exclusions", Components.interfaces.nsISupportsString, str);

		protListarr = null;
	},





	ToggleLSOProtection: function(mode)
	{
		var LSOTree = bpriv.getDoc().getElementById("LSOViewerTree");
		if(LSOTree.currentIndex < 0)
			return;
		var toModify = LSOTree.currentIndex;
		var path = bpriv.lsos[toModify].path;

		var exp = new RegExp(bpriv.lsos[toModify].file.leafName, 'i');
		path = path.replace(exp, "");
		path = path.replace(/[\\\/]$/i, "");
		if(bpriv.lsos[toModify].prot.indexOf("d") < 0){
			bpriv.AddToLSOProtection(path);
			bpriv.lsos[toModify].prot = "d";
		}else
		{
			bpriv.RemoveFromLSOProtection(path);
			bpriv.lsos[toModify].prot = bpriv.lsos[toModify].prot.replace(/d/g, "");
		}

		bpriv.RefreshLSOProtection();
		//bpriv.updateGUI(bpriv.GetFlashDir(0), false);
		bpriv.updateGUI(false);
		bpriv.TreeOnSelect();
	},



	DeleteLso: function()
	{
		var LSOTree = bpriv.getDoc().getElementById("LSOViewerTree");
		if(!bpriv.lsos[LSOTree.currentIndex])
			return;
		try{
			if(bpriv.lsos[LSOTree.currentIndex].file.exists())
				bpriv.lsos[LSOTree.currentIndex].file.remove(false);
			else
				alert("BetterPrivacy: This file does not exist anymore, nothing to do");
		}catch(e){alert("BetterPrivacy error: Failed to delete that file!"); return;}
                bpriv.lsos.splice(LSOTree.currentIndex , 1);
                LSOTree.treeBoxObject.rowCountChanged(LSOTree.currentIndex + 1 , -1);
		//bpriv.updateGUI(bpriv.GetFlashDir(0), false);
		bpriv.updateGUI(false);
		bpriv.TreeOnSelect();
		bpriv.delDirs(bpriv.GetFlashDir(0));
	},


	DeleteAllLsos: function()
	{
		var LSOTree = bpriv.getDoc().getElementById("LSOViewerTree");
		var protectedCookie = false;
		for (var x=0;x<bpriv.lsos.length;x++)
		{
			if(String(bpriv.lsos[x].prot).indexOf("d") >= 0 || String(bpriv.lsos[x].prot).indexOf("s") >= 0){
				protectedCookie = true;
				break;
			}
		}
		var button = 0;
		if(protectedCookie)
		{
			check = {value: false};
			var flags = bpriv.prompts.BUTTON_POS_0 * bpriv.prompts.BUTTON_TITLE_YES +
			            bpriv.prompts.BUTTON_POS_1 * bpriv.prompts.BUTTON_TITLE_NO  +
			            bpriv.prompts.BUTTON_POS_2 * bpriv.prompts.BUTTON_TITLE_CANCEL;
			button =bpriv.prompts.confirmEx(null, "BetterPrivacy", bpriv.getString("asktodeleteall"), flags, "", "", "", null, check);
			if(button == 2)
				return;
		}
		var deleted = 0;
		for (var x=0;x<bpriv.lsos.length;x++)
		{
			protectedCookie = false;
			if(String(bpriv.lsos[x].prot).indexOf("d") >= 0 || String(bpriv.lsos[x].prot).indexOf("s") >= 0)
				protectedCookie = true;
			try{
				if(!(button == 1 && protectedCookie)){
					bpriv.lsos[x].file.remove(false);
					deleted++;
				}
			}catch(e){}
		}
		if(deleted){
			bpriv.LSOTreeShow(bpriv.GetFlashDir(0));
			bpriv.TreeOnSelect();
			bpriv.delDirs(bpriv.GetFlashDir(0));
		}
	},




	GetRootDir: function(platform)
	{
		switch (platform){
		case "windows":
			return(Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("AppData", Components.interfaces.nsILocalFile));
		break;
		case "mac1":
			return(Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ULibDir", Components.interfaces.nsILocalFile));
		break;
		case "mac2":
			return(Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("UsrPrfs", Components.interfaces.nsILocalFile));
		break;
		case "linux":
			//gets user-directory
			return(Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("Home", Components.interfaces.nsILocalFile));
		break;
		}
		return null;
	},



	GetFlashDir: function(ForceSearch)	// detection of Flash Apps directory
	{
		//ForceSearch=0: Try current preference if available (user may have set directory manually) otherwise get predifined places
		//ForceSearch=1: Ignore current preference, get predefined places (e.g. portable mode)
		//ForceSearch=2: Ignore current preference, get predefined places and if this fails do a scan (e.g. search directory)

		var FlashDir = null;
		var knownDir = null;
		var ExToFind = new RegExp('^'+bputils.getPref("extensions.bprivacy.FlashDirRegEx")+'(\u005c\u002f|\u005c\u005c)?$', 'i');

		var Dir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		if(ForceSearch < 1)
		{
			var currentDir;
			try{
				currentDir = bpriv.prefs.getComplexValue("DataDir", Components.interfaces.nsILocalFile);
			}catch(e){}

			if (currentDir)
			{
				try{
			  		if(currentDir.path && currentDir.exists() && currentDir.isDirectory())
						knownDir = currentDir;
				}catch(e){}
			}

		}

		//scan
		if(ForceSearch > 0 && !knownDir)
		{
			try{
				//windows
				if(bpriv.GetRootDir("windows") && bpriv.GetRootDir("windows").exists() && bpriv.GetRootDir("windows").isDirectory())
				{
					FlashDir = bpriv.GetRootDir("windows");
					FlashDir.append("Roaming");
					FlashDir.append("Macromedia");
					if(FlashDir.exists() && FlashDir.isDirectory())
						knownDir = FlashDir;
					if(!knownDir)
					{
						FlashDir = bpriv.GetRootDir("windows");
						FlashDir.append("Macromedia");
						if(FlashDir.exists() && FlashDir.isDirectory())
							knownDir = FlashDir;
					}
					if(!knownDir && (!bputils.getPref("extensions.bprivacy.noAutoScan") || ForceSearch == 2))
						bpriv.FindLSORoot(bpriv.GetRootDir("windows"), ExToFind);
				}
			}catch(e){}
		}
		if(ForceSearch > 0 && !knownDir)
		{
			try{
				//mac1
				if(bpriv.GetRootDir("mac1") && bpriv.GetRootDir("mac1").exists() && bpriv.GetRootDir("mac1").isDirectory())
				{
					FlashDir = bpriv.GetRootDir("mac1");
					FlashDir.append("Preferences");
					FlashDir.append("Macromedia");
					if(FlashDir.exists() && FlashDir.isDirectory())
						knownDir = FlashDir;

					if(!knownDir && (!bputils.getPref("extensions.bprivacy.noAutoScan") || ForceSearch == 2))
						bpriv.FindLSORoot(bpriv.GetRootDir("mac1"), ExToFind);
				}
			}catch(e){}
		}
		if(ForceSearch > 0 && !knownDir)
		{
			try{
				//mac2
				if(bpriv.GetRootDir("mac2") && bpriv.GetRootDir("mac2").exists() && bpriv.GetRootDir("mac2").isDirectory())
				{
					FlashDir = bpriv.GetRootDir("mac2");
					FlashDir.append("Macromedia");
					if(FlashDir.exists() && FlashDir.isDirectory())
						knownDir = FlashDir;
					if(!knownDir && (!bputils.getPref("extensions.bprivacy.noAutoScan") || ForceSearch == 2))
						bpriv.FindLSORoot(bpriv.GetRootDir("mac2"), ExToFind);
				}
			}catch(e){}
		}
		if(ForceSearch > 0 && !knownDir)
		{
			try{
				//linux
				if(bpriv.GetRootDir("linux") && bpriv.GetRootDir("linux").exists() && bpriv.GetRootDir("linux").isDirectory())
				{
					FlashDir = bpriv.GetRootDir("linux");
					FlashDir.append(".macromedia");
					if(FlashDir.exists() && FlashDir.isDirectory())
						knownDir = FlashDir;
					if(!knownDir && (!bputils.getPref("extensions.bprivacy.noAutoScan") || ForceSearch == 2))
						bpriv.FindLSORoot(bpriv.GetRootDir("linux"), ExToFind);
				}
			}catch(e){}
		}


		try{
	  		if(knownDir.path && knownDir.exists() && knownDir.isDirectory())
			{
				bpriv.prefs.setComplexValue("DataDir", Components.interfaces.nsILocalFile, knownDir);
				return knownDir;
			}
		}catch(e){}

		return null;
	},



	SortLSOView: function(col)
	{
		var LSOTree = bpriv.getDoc().getElementById("LSOViewerTree");
		if(!LSOTree)
			return;
		bpriv.SortTable(col, bpriv.lsos, LSOTree);
	},



	SortTable: function(column, table, tree) {
		var columnName = column;
		if(!column)
		{
			if(tree.getAttribute("sortResource"))
				columnName = tree.getAttribute("sortResource");
			else
				return;
		}
		var order = tree.getAttribute("sortDirection") == "ascending" ? 1 : -1;
		//if it's already sorted by that column, reverse sort
		if (tree.getAttribute("sortResource") == column)
			order *= -1;
		columnSort = function compare(a, b)
		{
			if (bpriv.prepareForComparison(a[columnName]) > bpriv.prepareForComparison(b[columnName])) return 1 * order;
			if (bpriv.prepareForComparison(a[columnName]) < bpriv.prepareForComparison(b[columnName])) return -1 * order;
			return 0;
		}
		table.sort(columnSort);

		//setting these will make the sort option persist
		tree.setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
		tree.setAttribute("sortResource", columnName);
		tree.view = bpriv.treeView;

		//set the appropriate attributes to show to indicator
		var cols = tree.getElementsByTagName("treecol");
		for (var i = 0; i < cols.length; i++) {
			cols[i].removeAttribute("sortDirection");
		}
		bpriv.getDoc().getElementById(columnName).setAttribute("sortDirection", order == 1 ? "ascending" : "descending");

		//redraw tree
		tree.treeBoxObject.invalidate();

		//get old selection
		tree.view.selection.select(-1);
		if(bpriv.selected != null)
		{
			for (var i = 0; i < table.length; i++)
			{
				if (table[i].path == bpriv.selected)
				{
					tree.view.selection.select(i);
					//scroll into view
					tree.treeBoxObject.ensureRowIsVisible(i);
					break;
				}
			}

		}

	},



	//prepares an object for easy comparison against another. for strings, lowercases them
	prepareForComparison: function(obj) {
        	if (typeof obj == "string")
        		return obj.toLowerCase();
        	return obj;
	},



	showBetterPrivacy: function(){
		try{
			var enumerator = bpriv.wm.getEnumerator("");
			var win;
			while(enumerator && enumerator.hasMoreElements()) {
				awin = enumerator.getNext();
				if(awin && awin.document && awin.document.getElementById("bpriv-prefpane")){
					win = awin;
					break;
				}
			}
			if(!win)
				win = window.openDialog('chrome://bp/content/bp.xul', '_blank', 'chrome=yes, resizable=yes, centerscreen=yes', 1);
			//win.focus();
			setTimeout(function(){win.focus();}, 1000, win); //timeout needed to solve strange isssue with the 'Download Statusbar' addon (empty BP window)
		}catch(e){alert("An error occured while initializing BetterPrivacy options window (3)\r\nPlease send the following information to the author: \r\n"+e);}
	},



	getString: function(strID){
		var str = "";
		try{
			str = bpriv.getDoc().getElementById("strBundle").getString(strID);
		}catch(e){}
		return str;
	},


	hashString: function(str){
		var converter =
		  Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
		    createInstance(Components.interfaces.nsIScriptableUnicodeConverter);

		// we use UTF-8 here, you can choose other encodings.
		converter.charset = "UTF-8";
		// result is an out parameter,
		// result.value will contain the array length
		var result = {};
		// data is an array of bytes
		var data = converter.convertToByteArray(str, result);
		var ch = Components.classes["@mozilla.org/security/hash;1"]
		                   .createInstance(Components.interfaces.nsICryptoHash);
		ch.init(ch.MD5);
		ch.update(data, data.length);
		var hash = ch.finish(false);

		// return the two-digit hexadecimal code for a byte
		function toHexString(charCode)
		{
		  return ("0" + charCode.toString(16)).slice(-2);
		}

		// convert the binary hash data to a hex string.
		var s = [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
		// s now contains your hash in hex: should be
		return s;
	},



	onKeyCode: function()
	{
		bpriv.prepareDelLSO(0, null);
	},



        addSanitizeItem: function () {
                window.removeEventListener("load", bpriv.addSanitizeItem, true);
                if(!bputils.getPref("extensions.bprivacy.AutoDelLSOnExitMode"))
                return;
                if (typeof Sanitizer != 'function')
                return;
                // Sanitizer will execute this
                Sanitizer.prototype.items["extensions-betterprivacy"] =
                {
                clear : function(){
                  try{
                    bpriv.sanitize(window.document);
                  }catch(e){}
                },
                get canClear(){
                  return true;
                }
                }
        },



   addSanitizeMenuItem: function () {
      window.removeEventListener("load", bpriv.addSanitizeMenuItem, true);
      if(!bputils.getPref("extensions.bprivacy.AutoDelLSOnExitMode"))
        return;
      if(bpriv.isSeaMonkey)
        return;
      var prefs = document.getElementsByTagName("preferences")[0];
      if(!prefs.hasChildNodes())
        return;
      var id = prefs.lastChild.getAttribute("id");
      if (prefs && id)
      {
          var prefName;
          if (id.indexOf("privacy.cpd.") != -1)
          {
            prefName = "privacy.cpd.extensions-betterprivacy";
            var oldPrefName = "privacy.item.extensions-betterprivacy";
            //if an old pref exists then use it
            if (typeof bputils.getPref(prefName) != 'boolean'){
              if (typeof bputils.getPref(oldPrefName) == 'boolean')
                bputils.prefs.setBoolPref(prefName, bputils.getPref(oldPrefName));
              else
                bputils.prefs.setBoolPref(prefName, true);
            }
          }
          else if (id.indexOf("privacy.") != -1)
          {
            prefName = "privacy.clearOnShutdown.extensions-betterprivacy";
            if (typeof bputils.getPref(prefName) != 'boolean')
                bputils.prefs.setBoolPref(prefName, true);
          }
          else
            return;
          var pref = document.createElement("preference");
          pref.setAttribute("id", prefName);
          pref.setAttribute("name", prefName);
          pref.setAttribute("type", "bool");
          pref.setAttribute("defaultValue", true);
          prefs.appendChild(pref);
          var item;
          var itemList = document.getElementById("itemList");
          if (itemList)
            item = itemList.lastChild;
          else
          {
            item = document.getElementsByTagName("checkbox");
            item = item[item.length - 1];
          }
          var check = document.createElement(itemList ? "listitem" : "checkbox");
          check.setAttribute("label", "Flash Cookies");
          check.setAttribute("preference", prefName);
          if(itemList)
          {
            check.setAttribute("type", "checkbox");
            itemList.appendChild(check);
          }
          else
          {
            if(item.parentNode.childNodes.length == 2)
            {
              var row = document.createElement("row");
              item.parentNode.parentNode.appendChild(row);
              row.insertBefore(check, null);
            }else
              item.parentNode.insertBefore(check, null);
          }
          if (typeof gSanitizePromptDialog == "object")
          {
            //pref.setAttribute("readonly", "true");
            check.setAttribute("onsyncfrompreference", "return gSanitizePromptDialog.onReadGeneric();");
          }
          pref.setElementValue(check);
          bpriv.addSanitizeItem();
      }
   },


        sanitize: function (doc) {
                var p = doc.getElementById("privacy.cpd.extensions-betterprivacy");
                bputils.prefs.setBoolPref(p.name, p.value);
                var ticks = 0;
                if(doc.getElementById("sanitizeDurationChoice"))
                {
                	var idx = doc.getElementById("sanitizeDurationChoice").selectedIndex;
                	var currentTime = new Date();
                	switch(idx)
                	{
                	case 0: //1 hour
                	  ticks = 3600000;
                	  break;
                	case 1: //2 hours
                	  ticks = 7200000;
                	  break;
                	case 2: //4 hours
                	  ticks = 14400000;
                	  break;
                	case 3: //today
                	  ticks = (currentTime.getHours() * 60 * 60 * 1000) + (currentTime.getMinutes() * 60 * 1000) + (currentTime.getSeconds() * 1000);
                	  break;
                	}
                }
                //clear LSO data
                bpriv.prepareDelLSO(0, ticks);
        },


	extopened: function()
	{
        	var isExtensionsWin = document.getElementById("extensionsStrings");
        	try{
                        if (isExtensionsWin) //old extensions manager
                        {
                          eval("gExtensionsViewController.commands.cmd_options ="+gExtensionsViewController.commands.cmd_options.toString().replace(
                          'var optionsURL = aSelectedItem.getAttribute("optionsURL");','$& \ if (bpriv.isOptionsURL(optionsURL)) return;'));
                        }
        	}catch(e){alert("An error occured while initializing BetterPrivacy options window (1)\r\nPlease send the following information to the author: \r\n"+e);}
	},



	isOptionsURL: function(url) {
        	try{
                        if (url != "chrome://bp/content/bp.xul")
                          return false;
                        var gWindowManager =  Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
                        var aBrowser = gWindowManager.getMostRecentWindow("navigator:browser");
                        if (!aBrowser)
                        {
                            var rwin = gWindowManager.getMostRecentWindow("mozilla:betterprivacy");
                            if(rwin)
                               rwin.close();
                            bpriv.prompts.alert(window, "BetterPrivacy", "BetterPrivacy requires at least one open browser window!");
                        }
                        else
                          bpriv.showBetterPrivacy();
        	}catch(e){alert("An error occured while initializing BetterPrivacy options window (2)\r\nPlease send the following information to the author: \r\n"+e);}
        	return true;
	},



   _isSeaMonkey: null,
           get isSeaMonkey() {
            if (this._isSeaMonkey == null) {
                var appInfo=Components.classes["@mozilla.org/xre/app-info;1"]
                    .getService(Components.interfaces.nsIXULAppInfo);
                this._isSeaMonkey = appInfo.name == 'SeaMonkey';
             }
             return this._isSeaMonkey;
   },




};