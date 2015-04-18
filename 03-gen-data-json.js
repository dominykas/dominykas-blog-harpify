var Q = require("q"),
	_ = require("lodash"),
	readdir = require("recursive-readdir"),
	fs = require("fs"),
	writeFile = Q.nbind(fs.writeFile, fs),
	readFile = Q.nbind(fs.readFile, fs),
	yfm = require("yaml-front-matter"),
	path = require("path");

var blogs = ["../www.dominykas.com", "../www.dominykas.lt"];

function filterBlogPostFiles() {
	return function (bp) {
		return bp.match(/\.md$/);
	}
}

function parseBlogPosts(srcFolder) {
	return function (fn) {
		return readFile(fn)
			.then(function (contents) {
				return yfm.loadFront(contents);
			})
			.then(function (data) {
				var contents = data["__content"];
				delete data["__content"];
				var titleMatches = contents.match(/^\# (.*)$/m);
				if (titleMatches) {
					data.title = titleMatches[1];
				} else {
					// throw?
				}
				data.tags = data.tags.split(",").map(function (t) {
					return t.trim()
				});
				data.id = path.basename(fn, ".md");
				data.folder = path.relative(srcFolder, path.dirname(fn));
				return data;
			});
	}
}

function writeDataJson(postData, srcFolder) {
	var dataFn = srcFolder + "/_data.json";
	var dataJson = _(postData).mapValues(function (post) {
		return {
			id: post.id,
			title: post.title,
			date: post.published,
			tags: post.tags,
			published: true
		}
	}).sortBy("date").reverse().indexBy("id").value();
	return writeFile(dataFn, JSON.stringify(dataJson, null, "  ")).then(function () {
		return dataFn;
	});
}

function parseBlog(blogFolder) {
	var srcFolder = blogFolder + "/src";
	return Q.nfcall(readdir, srcFolder).then(function (fileList) {
		return Q.all(fileList.filter(filterBlogPostFiles()).map(parseBlogPosts(srcFolder)));
	}).then(function (postData) {
		return Q.all(_(postData).groupBy("folder").map(function (blogs, month) {
			return writeDataJson(blogs, srcFolder + "/" + month);
		}).value());
	});
}

Q.all(blogs.map(parseBlog))
	.spread(function () {
		console.log(arguments);
	})
	.catch(console.error)
	.done();
