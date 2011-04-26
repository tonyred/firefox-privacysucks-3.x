/***************************************************************************
Name: CookieSafe
Description: Control cookie permissions.
Author: Ron Beckman
Homepage: http://addons.mozilla.org

Copyright (C) 2007  Ron Beckman

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to:

Free Software Foundation, Inc.
51 Franklin Street
Fifth Floor
Boston, MA  02110-1301
USA
***************************************************************************/


const CS3RDPARTYHOSTS_CONTRACTID = '@mozilla.org/CS3rdPartyHosts;1';
const CS3RDPARTYHOSTS_CID = Components.ID('{dacc751f-20a0-4686-b405-bf482b869a78}');
const CS3RDPARTYHOSTS_IID = Components.interfaces.nsICS3rdPartyHosts;
const CS3RDPARTYHOSTS_SERVICENAME = 'CS 3rd Party Hosts';

var nsCS3rdPartyHosts = {

	hosts: [],

	test3rdParty: function(host) {
		for (var i=0; i<this.hosts.length; ++i) {
			if (this.hosts[i]==host) return true;
		}

		return false;
	},

	get3rdParty: function() {
		return this.hosts.join(' ');
	},

	add3rdParty: function(host) {
		var found = this.test3rdParty(host);
		if (!found) {
			this.hosts.unshift(host);
		}
	},

	remove3rdParty: function(host) {
		this.hosts = this.hosts.filter(function(value) {
								return value != host; 
							 });
	},

	clear3rdParty: function() {
		this.hosts = [];
	},

	QueryInterface: function(iid) {
		if (!iid.equals(Components.interfaces.nsISupports) &&
		    !iid.equals(CS3RDPARTYHOSTS_IID))
			throw Components.results.NS_ERROR_NO_INTERFACE;
		return this;
	}
};

var nsCS3rdPartyHostsModule = {

	registerSelf: function (compMgr, fileSpec, location, type) {
		var compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
		compMgr.registerFactoryLocation(CS3RDPARTYHOSTS_CID,
						CS3RDPARTYHOSTS_SERVICENAME,
						CS3RDPARTYHOSTS_CONTRACTID,
						fileSpec,location,type);
	},

	unregisterSelf: function (compMgr, fileSpec, location) {
		var compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
		compMgr.unregisterFactoryLocation(CS3RDPARTYHOSTS_CID,fileSpec);
	},

	getClassObject: function (compMgr, cid, iid) {
		if (!cid.equals(CS3RDPARTYHOSTS_CID))
			throw Components.results.NS_ERROR_NO_INTERFACE;
		if (!iid.equals(Components.interfaces.nsIFactory))
			throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
		return this.nsCS3rdPartyHostsFactory;
	},

	nsCS3rdPartyHostsFactory: {

		createInstance: function (outer, iid) {
			if (outer != null)
				throw Components.results.NS_ERROR_NO_AGGREGATION;
			if (!iid.equals(CS3RDPARTYHOSTS_IID) &&
			    !iid.equals(Components.interfaces.nsISupports))
				throw Components.results.NS_ERROR_INVALID_ARG;
			return nsCS3rdPartyHosts;
		}
	},

	canUnload: function(compMgr) {
		return true;
	}
};

function NSGetModule(compMgr, fileSpec) {
	return nsCS3rdPartyHostsModule;
}
