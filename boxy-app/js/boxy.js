"use strict";

var remote = require('remote')
const electron = remote.require('electron');
// Module to control application life.
const app = electron.app;

var Menu = remote.require('menu')
var MenuItem = remote.require('menu-item')
let hoxy = require('hoxy');
let hljs = require('highlight.js');
var jsonfile = require('jsonfile');
//window.$ = window.jQuery = require('jquery');

//require("../bower_components/jquery.splitter/js/jquery.splitter-0.20.0.js");
var template = [
  {
      label: app.getName(),
      submenu: [
        {
          label: 'About ' + name,
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: function() { app.quit(); }
        },
      ]
    }
];

var menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

// Build our new menu
var menu = new Menu()
menu.append(new MenuItem({
  label: 'Open developer tool',
  click: function() {
    remote.getCurrentWindow().webContents.openDevTools();
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
.controller("MainController", function($scope, $sce) {
  this.serverList = [
    /*
    {
      name: "HTTP Bin",
      remoteURL: "http://httpbin.org",
      localPort: "8080",
      started: false,
      requestList: []
    },
    {
      name: "Example.com",
      remoteURL: "http://example.com",
      localPort: "8081",
      started: false,
      requestList: []
    }
    */
  ];
  this.editableServer = {
    name: "",
    remoteURL: "",
    localPort: "",
    started: false
  }
  this.selectedServer = undefined;
  this.dialogMode = "ADD";
  this.selectedRequest = undefined;
  this.activeTab = 'request';
  this.requestBodyFormat = 'pretty';
  this.responseBodyFormat = 'pretty';

  this.isServerSelected = function(server) {
    return server === this.selectedServer;
  }
  this.selectServer = function(server) {
    this.selectedServer = server;
    this.selectedRequest = undefined;
  }
  this.startButtonEnabled = function() {
    return this.selectedServer !== undefined && !this.selectedServer.started;
  }
  this.stopButtonEnabled = function() {
    return this.selectedServer !== undefined && this.selectedServer.started;
  }
  this.openNewServerDialog = function() {
    this.dialogMode = "ADD";
    this.editableServer.name = "";
    this.editableServer.remoteURL = "";
    this.editableServer.localPort = "";

    document.getElementById("editableServerDialog").showModal();
  }
  this.closeNewServerDialog = function() {
    document.getElementById("editableServerDialog").close();
  }

  function getUserHome() {
    return process.env.HOME || process.env.USERPROFILE;
  }

  this.saveServerFile = function() {
    var file = getUserHome() + "/" + ".boxy";

    jsonfile.writeFile(file, this.serverList, function (err) {
      if (err !== null) {
        alert(`Filed to save settings: ${file}`);
        console.error(err);
      }
    });
  }

  this.loadServerFile = function() {
    var file = getUserHome() + "/" + ".boxy";

    jsonfile.readFile(file, (err, obj) => {
      if (err !== null || obj === undefined) {
        if (err.code !== 'ENOENT') {
          alert(`Filed to load settings: ${file}`);
        }
        console.error(err);
      } else {
        this.serverList = obj;
        $scope.$apply();
      }
    });
  }

  this.addNewServer = function() {
    console.log("Adding new server.");
    this.closeNewServerDialog();
    var server = {
      name: this.editableServer.name,
      remoteURL: this.editableServer.remoteURL,
      localPort: this.editableServer.localPort,
      started: this.editableServer.started,
      requestList: []
    }
    this.serverList.push(server);
    this.selectedServer = server;
    this.saveServerFile();
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
    if (this.selectedServer.started) {
      this.stopServer();
    }

    //Remove the server.
    this.serverList.splice(idx, 1);

    this.selectedServer = undefined;

    this.saveServerFile();
  }

  this.openEditServerDialog = function() {
    if (this.selectedServer === undefined) {
      return;
    }

    this.dialogMode = "EDIT";

    this.editableServer.name = this.selectedServer.name;
    this.editableServer.remoteURL = this.selectedServer.remoteURL;
    this.editableServer.localPort = this.selectedServer.localPort;

    document.getElementById("editableServerDialog").showModal();
  }

  this.updateServerSettings = function() {
    if (this.selectedServer === undefined) {
      return;
    }

    this.selectedServer.name = this.editableServer.name;
    this.selectedServer.remoteURL = this.editableServer.remoteURL;
    this.selectedServer.localPort = this.editableServer.localPort;

    if (this.selectedServer.started) {
      //Restart the server
      this.stopServer();
      this.startServer();
    }

    document.getElementById("editableServerDialog").close();

    this.saveServerFile();
  }

  this.startServer = function() {
    if (this.selectedServer === undefined || this.selectedServer.started) {
      return;
    }

    var textTypes = [
      "application/xml",
      "application/json",
      "text/html",
      "text/json"
    ];
    var theServer = this.selectedServer; //Closure variable

    theServer.proxy = hoxy.createServer({
      reverse: theServer.remoteURL
    })
    .listen(theServer.localPort, function() {
      theServer.started = true;
      $scope.$apply();

      theServer.proxy.intercept({
        phase: 'request',
        as: 'buffer'
      }, (req, resp, cycle) => {
        //console.log(req.buffer.toString('utf8'));
        var contentType = req.headers["content-type"];
        var reqTxt = "";

        if (textTypes.some((type) => {
            return contentType !== undefined && contentType.startsWith(type);
        })) {
          console.log("Detected text type request.")
          var buff = req.buffer;
          if (buff !== undefined) {
            reqTxt = buff.toString('utf8');
          } else {
            console.log("Request buffer is undefined.");
          }
        }
        req.boxyRequestData = {
          requestText: reqTxt,
          request: req,
          startTime: new Date()
        };
      });

      theServer.proxy.intercept({
        phase: 'response',
        as: 'buffer'
      }, (req, resp, cycle) => {
        console.log(req);
        console.log(resp);
        var contentType = resp.headers["content-type"];
        var respTxt = "";

        if (textTypes.some((type) => {
            return contentType !== undefined && contentType.startsWith(type);
        })) {
          console.log("Detected text type response.")
          var buff = resp.buffer;
          if (buff !== undefined) {
            respTxt = buff.toString('utf8');
          } else {
            console.log("Response buffer is undefined.");
          }
        }

        req.boxyRequestData.response = resp;
        req.boxyRequestData.responseText = respTxt;
        req.boxyRequestData.endTime = new Date();
        req.boxyRequestData.duration = req.boxyRequestData.endTime.getTime() -
          req.boxyRequestData.startTime.getTime();
        req.boxyRequestData.formattedStartTime = "" +
          (req.boxyRequestData.startTime.getMonth() + 1) + "/" +
          req.boxyRequestData.startTime.getDate() + "/" +
          req.boxyRequestData.startTime.getFullYear() + " " +
          req.boxyRequestData.startTime.getHours() + ":" +
          req.boxyRequestData.startTime.getMinutes();


        theServer.requestList.push(req.boxyRequestData);

        $scope.$apply();
      });
    })
    .on("error", function(err) {
      console.log(err);
      if (err.code === 'EADDRINUSE') {
        alert(`Could not start server. Port ${err.port} is already in use.`);
      } else if (err.code === 'EACCES') {
          alert(`Could not start server. You don't have access to port ${err.port}.`);
      } else {
        alert("Failed to start server.")
      }
    });
  }

  this.stopServer = function() {
    if (this.selectedServer === undefined || !this.selectedServer.started) {
      return;
    }

    this.selectedServer.proxy.close();
    this.selectedServer.proxy = undefined;
    this.selectedServer.started = false;
  }

  this.selectRequest = function(req) {
    this.selectedRequest = req;
    this.activeTab = 'request';
    console.log("Request: %s\n", req.requestText);
    console.log("Response: %s\n", req.responseText);
  }

  this.isRequestSelected = function(req) {
    return this.selectedRequest === req;
  }

  this.setRequestBodyFormat = function(fmt) {
    this.requestBodyFormat = fmt;
  }

  this.setResponseBodyFormat = function(fmt) {
    this.responseBodyFormat = fmt;
  }

  //Item can be a hoxy request or response
  this.getContentType = function(item) {
    return item.headers["content-type"];
  }

  this.getFormattedRequest = function() {
    if (this.selectedRequest === undefined) {
      return "";
    }

    if (this.selectedRequest.formattedRequestText === undefined) {
      var fmtTxt = this.prettyfy(this.selectedRequest.request, this.selectedRequest.requestText)

      // console.log("Raw text: %s", this.selectedRequest.requestText)
      // console.log("Formatted text: %s", fmtTxt.value);

      this.selectedRequest.formattedRequestText = $sce.trustAsHtml(fmtTxt.value);
    }

    return this.selectedRequest.formattedRequestText;
  }

  this.prettyfy = function(entity, text) {
    var textTypes = [
      ["application/xml", "xml", undefined],
      ["application/json", "json", undefined],
      ["text/html", "html", undefined],
      ["text/json", "json", undefined]
    ];
    var contentType = this.getContentType(entity);

    textTypes.some(typeItem => {
      if (contentType !== undefined && contentType.startsWith(typeItem[0])) {
        //Beautify first
        if (typeItem[2] !== undefined) {
          //text = typeItem[2](text);
          //console.log("vkbeautify: %s", text);
        }
        //Then syntax highlight
        text = hljs.highlightAuto(text, [typeItem[1]]);

        return true;
      }

      return false;
    });

    return text;
  }

  this.getFormattedResponse = function() {
    if (this.selectedRequest === undefined) {
      return "";
    }

    if (this.selectedRequest.formattedResponseText === undefined) {
      var fmtTxt = this.prettyfy(this.selectedRequest.response, this.selectedRequest.responseText)

      // console.log("Raw text: %s", this.selectedRequest.responseText)
      // console.log("Formatted text: %s", fmtTxt.value);

      this.selectedRequest.formattedResponseText = $sce.trustAsHtml(fmtTxt.value);
    }

    return this.selectedRequest.formattedResponseText;
  }

  this.init = function() {
    this.loadServerFile();
  }

  this.init(); //Initialize the controller.
});
