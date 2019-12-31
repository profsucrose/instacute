require('dotenv').config()
const { IgApiClient } = require('instagram-private-api')
const fs = require('fs')
const request = require('request-promise')
const https = require('https')
const Stream = require('stream').Transform
const resizeImg = require('resize-img');
const sizeOf = require('buffer-image-size');
const functions = require('firebase-functions');

const ig = new IgApiClient();

const getRand = arr => arr[Math.floor(Math.random() * arr.length)]

const foodURL = 'https://www.pinterest.com/pskullfreak/kawaii-food/'
const animalsURL = 'https://www.pinterest.com/weesqueakshoes/cute-animal-pics/'

async function login() {
	// basic login-procedure
	ig.state.generateDevice(process.env.IG_USERNAME)
	await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD)
}

function getFoodURLs() {
	return request(foodURL).then(data =>
		data.match(/"url": "[^\s]+.jpg"/g).map(url => url.split(' ')[1].substring(1, url.split(' ')[1].length - 1))
	)
}

function getAnimalURLs() {
	return request(foodURL).then(data =>
		data.match(/"url": "[^\s]+.jpg"/g).map(url => url.split(' ')[1].substring(1, url.split(' ')[1].length - 1))
	)
}

function getBufferFromURL(url) {
	return new Promise((res, _rej) => {
		https.get(url, response => {
			let data = new Stream()
			response.on('data', chunk => {
				data.push(chunk)
			})
			response.on('end', () => {
				res(data.read())
			})
		})
	})
}

async function uploadPhoto(url) {
	const { latitude, longitude, searchQuery } = {
		latitude: 37.3861,
		longitude: 122.0839,
		// not required
		searchQuery: 'place',
	};

	const locations = await ig.search.location(latitude, longitude, searchQuery)
	const mediaLocation = locations[0]
	const rawFile = await getBufferFromURL(url)

	const { width, height } = sizeOf(rawFile)
	const aspectRatio = width / height
	const [newWidth, newHeight] = aspectRatio < 0.8
		? [width * 0.8, height * aspectRatio]
		: [width, height]

	const file = await resizeImg(rawFile, {
		width: newWidth,
		height: newHeight
	})
	const publishResult = await ig.publish.photo({
		// read the file into a Buffer
		file,
		location: mediaLocation,
		caption: 'Another cute picture!'
	})

	console.log(publishResult);
}

async function uploadPhotos(count) {
	await login()
	const animalURLs = await getAnimalURLs()
	const foodURLs = await getFoodURLs()

	for (let i = 0; i < count; i++) {
		const url = getRand(Math.random() > 0.5 ? animalURLs : foodURLs)
		console.log('Attempting to upload: ', url)
		uploadPhoto(url)
	}
}

exports.uploadPhoto = functions.https.onRequest((req, res) => {
	console.log(req.query.auth, process.env.AUTH_TOKEN)
	if (req.query.auth === process.env.AUTH_TOKEN) {
		console.log('Attempting image upload')
		uploadPhotos(1)
		res.status(200).send('Successfully attempted image upload')
	} else {
		res.status(403).send('Incorrect auth token')
	}
});
