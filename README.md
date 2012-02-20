## Recursive file walking / copying for node.js with middleware



Copyr Example:

```javascript
var walkFiles = require('walkr'),
fs        = require('fs'),
tplData   = {},
mu        = require('mu');

walkFiles(source, destination).
filter(/^\./). //no hidden files AND dirs
filterDir(/node_modules/). //no node_modules dir
filterFile(function(options, next) {
	

	//template file? parse it, and copy it.
	if(options.source.match(/.tpl.html/)) {
		
		//after write file, call next. SINCE parameters are given, walkr assumes files were written, so it does
		//not continue.
		return fs.writeFile(options.destination, mu.to_html(fs.readFileSync(source, "utf8"), tplData), next);

	}

	//call next without parameters 
	return next();
}).
filter(walkFiles.copy).
start(function(err) {
	
	//done
});
```


Walkr Example:

```javascript
var walkFiles = require('walkr');

walkFiles(source).
on('directory', function(ops) {
	console.log(ops.source);
}).
on('file', function(ops) {
	console.log(ops.source);
}).
start(function(err) {
	
});
```

