var assert = require("assert"),
	Q = require("q"),
	_ = require("lodash"),
	readdir = require("recursive-readdir"),
	fs = require("fs"),
	writeFile = Q.nbind(fs.writeFile, fs),
	jsdom = require("jsdom");

var blogs = ["../www.dominykas.com"];

function getRelativeFn(fn, folder) {
	return fn.substr(folder.length);
}

function filterBlogPostFiles(srcFolder) {
	return function (bp) {
		return !!getRelativeFn(bp, srcFolder).match(/^\/\d\d\d\d\/\d\d\/(.*)\.html$/);
	}
}

function parseBlogPosts(srcFolder) {
	return function (fn) {
		var relativeFn = getRelativeFn(fn, srcFolder);
		return Q.ninvoke(jsdom, "env", fn).then(function (window) {
			var document = window.document;
			var h1 = document.querySelectorAll("#content .post > header:first-child h1");
			assert.equal(h1.length, 1, "<h1> in " + relativeFn);
			assert.equal(h1[0].children.length, 1, "Children in <h1>" + relativeFn);

			var date = document.querySelectorAll("#content .post > header:first-child time");
			assert.equal(date.length, 1, "<time> in " + relativeFn);

			var body = document.querySelectorAll("#content .post > .postbody");
			assert.equal(body.length, 1, ".postbody in " + relativeFn);

			return {
				id: relativeFn.substr(1, relativeFn.length - 6),
				title: h1[0].children[0].innerHTML,
				date: date[0].getAttribute("datetime"),
				body: body[0].innerHTML.trim()
			};
		});
	}
}

function writeBlogPost(srcFolder) {
	return function (post) {
		var postFn = srcFolder + "/" + post.id + ".md";
		var postBody = "# " + post.title + "\n\n" + post.body.replace(/\r/, "");
		return writeFile(postFn, postBody).then(function () {
			return postFn;
		});
	}
}

function writeBlogPosts(postData, srcFolder) {
	return Q.all(postData.map(writeBlogPost(srcFolder)))
}

function writeDataJson(postData, srcFolder) {
	var dataFn = srcFolder + "/_data.json";
	var dataJson = _(postData).mapValues(function (post) {
		return {
			id: post.id,
			title: post.title,
			date: post.date,
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
		return Q.all(fileList.filter(filterBlogPostFiles(srcFolder)).map(parseBlogPosts(srcFolder)))
	}).then(function (postData) {
		return Q.all([writeBlogPosts(postData, srcFolder), writeDataJson(postData, srcFolder)]);
	});
}

Q.all(blogs.map(parseBlog))
	.spread(function () {
		console.log(_.flattenDeep(arguments));
	})
	.catch(console.error)
	.done();
