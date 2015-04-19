var Q = require("q"),
	_ = require("lodash"),
	glob = require("glob"),
	fs = require("fs"),
	writeFile = Q.nbind(fs.writeFile, fs),
	readFile = Q.nbind(fs.readFile, fs),
	yfm = require("yaml-front-matter"),
	path = require("path");

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
				if (data.tags) {
					data.tags = data.tags.split(",").map(function (t) {
						return t.trim()
					});
				}
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

function parseBlog(srcFolder) {
	return Q.nfcall(glob, srcFolder + "/**/*.md").then(function (fileList) {
		return Q.all(fileList.map(parseBlogPosts(srcFolder)));
	});
}

function updateBlog(blogFolder) {
	var srcFolder = blogFolder + "/src";
	return parseBlog(srcFolder).then(function (postData) {
		return Q.all(_(postData).groupBy("folder").map(function (blogs, month) {
			return writeDataJson(blogs, srcFolder + "/" + month);
		}).value());
	});
}

Q.all(require("./folders.json").map(updateBlog)).spread(console.log).catch(console.error).done();
