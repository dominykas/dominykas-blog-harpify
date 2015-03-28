var Q = require("q"),
	_ = require("lodash"),
	fs = require("fs"),
	readFile = Q.nbind(fs.readFile, fs),
	writeFile = Q.nbind(fs.writeFile, fs);

var blogs = ["../www.dominykas.com", "../www.dominykas.lt"];

function updateFile(srcFolder) {
	return function (fileData) {
		var fn = srcFolder + "/" + fileData.id + ".md";
		return readFile(fn)
			.then(function (contents) {
				var fileInfoComment = "---\npublished: " + fileData.date + "\ntags: " + fileData.tags.join(", ") + "\n---\n\n";
				return writeFile(fn, fileInfoComment + contents.toString());
			});
	}
}

function dataToMd(blogFolder) {
	var srcFolder = blogFolder + "/src";
	return readFile(srcFolder + "/_data.json")
		.then(function (data) {
			return Q.all(_.map(JSON.parse(data.toString()), updateFile(srcFolder)));
		})
}

Q.all(blogs.map(dataToMd))
	.spread(function () {
		console.log(_.flattenDeep(arguments));
	})
	.catch(console.error)
	.done();
