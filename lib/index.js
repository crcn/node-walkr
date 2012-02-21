var EventEmitter = require("events").EventEmitter,
step             = require("step"),
outcome          = require("outcome"),
fs               = require("fs"),
path             = require("path");


//note - 

module.exports = function(_source, _destination, _self) {
	
	if(!_self) _self = {};
	
	var _em       = new EventEmitter(),
	_filters      = { file: [], directory: [] },
	_error,
	_on           = outcome.error(function(err){ 
		_error = err;
	}),
	_maxOpenFiles = 512,
	_openFiles    = 0;

	
	/**
	 */


	_self.on = function(type, callback) {
		
		_em.addListener(type, callback);
		return _self;

	};

	/**
	 */

	_self.once = function(type, callback) {

		_em.addListener(type, callback);
		return _self;

	};

	/**
	 */

	_self.filterDir = function(search) {

		_addFilter('directory', search);	
		return _self;

	};

	/**
	 */

	_self.filterFile = function(search) {

		_addFilter('file', search);	
		return _self;
		
	};

	/**
	 */

	_self.filter = function(search) {

		_self.filterDir(search);
		return _self.filterFile(search);

	};

	/**
	 */

	_self.start = function(source, destination, callback) {

		if(typeof source == 'function') {
			callback = source;
			source = undefined;
			destination = undefined;
		}

		if(typeof destination == 'function') {
			callback = destination;
			destination = undefined;
		}


		_walk(source || _source, destination || _destination, callback);

	};

	/**
	 */

	function _addFilter(type, search) {

		if(search instanceof Array) {

			return search.forEach(function(search) {

				_addFilter(type, search);

			});

		}

		var filters = _filters[type];
		
		var fn;

		if(search instanceof RegExp) {

			fn = {
				test: function(options, next) {

					next(!search.test(options.name));

				}
			};

		} else
		if(search instanceof Function) {

			fn = {
				test: search
			}

		} else {

			throw new Error("search must be a function, or regular expression")

		}

		filters.push(fn);

	}

	/**
	 */

	function _filter(options, next) {


		var filters = _filters[options.type], numFilters = filters.length;


		function filterNext(index) {

			if(index == filters.length) return next(true);

			var filter = filters[index];

			filter.test(options, function(keep) {
				
				//arguments? stop the filter
				return arguments.length && !keep ? next(false) : filterNext(index + 1);

			});
		}


		filterNext(0);
	}


	/**
	 */

	function _walkDir(options, next) {

		var on      = outcome.error(next),
		source      = options.source,
		destination = options.destination;
		
		step(

			/**
			 */

			function init() {

				if(!destination) return this();

				//try making the dir - doesn't matter if it errors - what if it already exists?
				fs.mkdir(destination, 0755, this);

			},

			/**
			 */

			function onMakeDir() {
				
				// this(null, fs.readdirSync(options.source));
				fs.readdir(options.source, this);

			},

			/**
			 */

			on.success(function onFiles(files) {
				
				_openFiles--;


				var numFiles = files.length,
				next         = this;

					
				function walkFiles(index) {

					if(index == numFiles) return next();

					var fileName = files[index],
					srcFile      = source      + "/" + fileName,
					dstFile      = destination ? destination + "/" + fileName : undefined;

					_walk(srcFile, dstFile, function(err) {

						if(err) return next(err);

						walkFiles(index + 1);

					});

				}

				
				walkFiles(0);

			}),

			/**
			 */


			next
			

		);
	}

	/**
	 */

	function _walk(source, destination, next) {

		if(_error) return next(_error);

		//make the file wait a bit if stuff's being processed.
		//this hasn't happened while testing, but it's a nice fallback incase
		//anything changes
		if(_openFiles > _maxOpenFiles) {

			return process.nextTick(function() {

				_walk(source, destination, next);

			});

		}

		var options = {
			source: source,
			destination: destination
		};
		
		_openFiles++;
		
		step(

			/**
			 */

			function init() {


				//much faster - still async
				try {

					var stat = fs.lstatSync(source);
					this(null, stat);

				} catch(e) {

					this(e);

				}

				//fs.lstat(source, this);

			},

			/**
			 */

			function onFileStat(err, stat) {
				
				//just skip - no error.
				if(err) {

					_openFiles--;
					return next();

				}

				var isDirectory = stat.isDirectory(),
				next            = this;

				options.name    = path.basename(source);
				options.type    = isDirectory ? "directory" : "file";
				options.stat    = stat;

				_em.emit(options.type, options);


				_filter(options, function(use) {


					if(!use) {

						_openFiles--;
						return next();

					}


					if(isDirectory) {

						_walkDir(options, next);

					} else {

						_openFiles--;
						next();

					}

				});

			},


			/**
			 */

			function onFinished(err, result) {

				next(err, result);

			}
			

		);
	}

	_self.filterFile(/.DS_Store/);

	return _self;
}


/**
 * copy filter
 */

module.exports.copy = function(options, next) {

	if(options.stat.isDirectory() || !options.destination) return next();

	var istream = fs.createReadStream(options.source),
	ostream     = fs.createWriteStream(options.destination);

	istream.pipe(ostream);
	istream.once("end", next);

}
