#Boxy Reverse Proxy Server

Boxy is a GUI frontend for a reverse proxy server. This can be used to
debug web service calls.

The proxy engine is from the excellent hoxy framework.

## Development Instructions
First clone this repo:

```
git clone https://github.com/bibhas2/boxy.git
```

Then from the project's root directory:

```
npm install
bower install
npm start
```

To build an app for Mac OS/X:

```
npm run pack:osx

```

To build an app for Windows:

```
npm run pack:win32

```

The app will be in ``dist/Boxy-darwin-x64/Boxy.app``.

## Using Boxy
![Demo](https://raw.githubusercontent.com/bibhas2/boxy/master/assets/demo.gif)
