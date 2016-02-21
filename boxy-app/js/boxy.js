var remote = require('remote')
var Menu = remote.require('menu')
var MenuItem = remote.require('menu-item')
//window.$ = window.jQuery = require('jquery');

//require("../bower_components/jquery.splitter/js/jquery.splitter-0.20.0.js");

// Build our new menu
var menu = new Menu()
menu.append(new MenuItem({
  label: 'Delete',
  click: function() {
    // Trigger an alert when menu item is clicked
    alert('Deleted')
  }
}))
menu.append(new MenuItem({
  label: 'More Info...',
  click: function() {
    // Trigger an alert when menu item is clicked
    alert('Here is more information')
  }
}))

// Add the listener
document.addEventListener('DOMContentLoaded', function () {
  // document.querySelector('.js-context-menu').addEventListener('click', function (event) {
  //   menu.popup(remote.getCurrentWindow());
  // })
  document.addEventListener('contextmenu', function (event) {
    menu.popup(remote.getCurrentWindow());
  })
})

angular.module("BoxyApp", [])
.controller("MainController", function() {
  this.serverList = [
    {
      name: "One",
      started: false
    },
    {
      name: "Two",
      started: true
    }
  ];
  this.editableServer = {
    name: "",
    remoteHost: "",
    remotePort: "",
    localPort: "",
    started: false
  }
  this.selectedServer = undefined;

  this.isServerSelected = function(server) {
    return server === this.selectedServer;
  }
  this.selectServer = function(server) {
    this.selectedServer = server;
  }
  this.startButtonEnabled = function() {
    return this.selectedServer !== undefined && !this.selectedServer.started;
  }
  this.stopButtonEnabled = function() {
    return this.selectedServer !== undefined && this.selectedServer.started;
  }
  this.openNewServerDialog = function() {
    document.getElementById("editableServerDialog").showModal();
  }
  this.closeNewServerDialog = function() {
    document.getElementById("editableServerDialog").close();
  }

  this.addNewServer = function() {
    console.log("Adding new server.");
    this.closeNewServerDialog();
    var server = {
      name: this.editableServer.name,
      remotePort: this.editableServer.remotePort,
      remoteHost: this.editableServer.remoteHost,
      localPort: this.editableServer.localPort,
      started: this.editableServer.started
    }
    this.serverList.push(server);
  };

  this.removeServer = function() {
    if (this.selectedServer === undefined) {
      return;
    }

    var idx = this.serverList.indexOf(this.selectedServer);

    if (idx < 0) {
      return;
    }
    //Stop the server.
    //Remove the server.
    this.serverList.splice(idx, 1);

    this.selectedServer = undefined;
  }
});
