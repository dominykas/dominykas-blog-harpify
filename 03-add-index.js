var Q = require("q"),
	glob = require("glob"),
	fs = require("fs"),
	writeFile = Q.nbind(fs.writeFile, fs),
	path = require("path");

function writeIndex(subFolder, srcFolder) {
	var indexFn = srcFolder + "/" + subFolder + "/index.md";
	var indexData = "# " + subFolder;
	return writeFile(indexFn, indexData).then(function () {
		return indexFn;
	});
}

function updateBlog(blogFolder) {
	var srcFolder = blogFolder + "/src";
	return Q.nfcall(glob, srcFolder + "/**/").then(function (list) {
		return Q.all(list.map(function(folder){
			return path.relative(srcFolder, folder);
		}).filter(function(folder) {
			return folder.match(/^[\d\/]+$/);
		}).map(function (folder) {
			return writeIndex(folder, srcFolder)
		}));
	});
}

Q.all(require("./folders.json").map(updateBlog)).spread(console.log).catch(console.error).done();
