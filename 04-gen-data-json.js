var Q = require("q"),
	_ = require("lodash"),
	glob = require("glob"),
	fs = require("fs"),
	writeFile = Q.nbind(fs.writeFile, fs),
	readFile = Q.nbind(fs.readFile, fs),
	yfm = require("yaml-front-matter"),
	path = require("path"),
	slug = require("slug");

function isBlogFile(srcFolder) {
	return function (fn) {
		return path.relative(srcFolder, fn).match(/^\d/);
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

function writeTag(tag, srcFolder) {
	var tagFn = srcFolder + "/" + tag.id + ".md";
	var tagContent = "# Tag: " + tag.title; // @todo: translate
	return writeFile(tagFn, tagContent).then(function () {
		return tagFn;
	});
}

function parseBlog(srcFolder) {
	return Q.nfcall(glob, srcFolder + "/**/*.md").then(function (fileList) {
		return Q.all(fileList.filter(isBlogFile(srcFolder)).map(parseBlogPosts(srcFolder)));
	});
}

function updateBlog(blogFolder) {
	var srcFolder = blogFolder + "/src";
	return parseBlog(srcFolder).then(function (postData) {
		var dataJsonPromises = _(postData).groupBy("folder").map(function (blogs, month) {
			return writeDataJson(blogs, srcFolder + "/" + month);
		}).value();

		var tagFolder = srcFolder + "/tag";
		var tagData = _(postData).pluck("tags").filter().flattenDeep().uniq().map(function (tag) {
			return {
				id: slug(tag),
				title: tag
			}
		}).value();
		var tagPromises = tagData.map(function (tag) {
			return writeTag(tag, tagFolder);
		});
		return Q.all(_.flatten([
			dataJsonPromises,
			tagPromises,
			writeFile(tagFolder + "/index.md", "# Tags"), // @todo: translate...
			writeDataJson(_.indexBy(_.sortBy(tagData, "id").reverse(), "id"), tagFolder)
		]));
	});
}

Q.all(require("./folders.json").map(updateBlog)).spread(console.log).catch(console.error).done();
