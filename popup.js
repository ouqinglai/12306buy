var SUBMIT = $('#order_submit')
,	url1 = 'https://kyfw.12306.cn/otn/'
,	stationName
,	hook = [e => e.preventDefault() , (match , value) => {
	chrome.runtime.sendMessage({
        match,
        value,
    })
}]

/* init */
$('[name="to_date"]').value = new Date().toLocaleDateString().replace(/\//g , '-')
$('[name="time"]').value = new Date().toTimeString().match(/\d+:\d+/)[0]

//check 12306 login
Fetch('index/initMy12306')
.then(res => {
	whichFormShow(res.url === url1 + 'index/initMy12306' ? 3 : 2)
})

//当错误提示框后台运行时，点击图片时让它再次显示
chrome.runtime.sendMessage({ match : 'iconClick' })

//获取车站对应编码
Fetch('resources/js/framework/station_name.js?station_version=1.8971' , res => stationName = res , 'text')

/* eventBind */
$('#loginForm').onsubmit = function (e) {
	hook[0](e)
	hook[1]('userLogin' , formData(this))
}

$('#order').onsubmit = function (e) {
	hook[0](e)

	let orderInfo = formData(this)
	,	{ from , to } = orderInfo

	orderInfo.from = findStationCode(from)
	orderInfo.to = findStationCode(to)

	if(orderInfo.mode === 'buy') SUBMIT.setAttribute('disabled' , '')

	hook[1]('orderInfo' , orderInfo)
}

chrome.runtime.onMessage.addListener(({ match , value }) => {
	if(match === 'loginCb') {
		whichFormShow(3)
	}else if (match === 'errorCb') {
		SUBMIT.removeAttribute('disabled')
	}
})

/* helper */

//获取常用联系人（乘客）信息
function getPassenger (){
	Fetch('confirmPassenger/getPassengerDTOs' , ({ data : { normal_passengers } }) => {
		let passenger = normal_passengers[0]

		if(passenger) {
			Array('passenger_name' , 'passenger_id_no' , 'mobile_no').forEach(id => $('#' + id).value = passenger[id] || '(无)')
		}else {
			SUBMIT.setAttribute('disabled' , '')
			new Notification('请先设置常用联系人！' , {
				icon : './logo.png'
			})
		}
	})
}

function Fetch (api , cb , type = 'json') {
	let promise = fetch(url1 + api , {
		credentials: 'include',
		headers : { 'Cache-Control' : 'no-cache' }
	})

	if(cb) {
		promise
		.then(res => res[type]())
		.then(res => cb(res))
	}else
		return promise
}

function findStationCode (name){
	return [name , stationName.match(new RegExp('\\|' + name + '\\|[a-zA-z]+\\|'))[0].split('|')[2]]
}

function $ (selector){
	return document.querySelector(selector)
}

function formData (form){
	let obj = {}

	;[].slice.call(form.querySelectorAll('[name]')).forEach(dom => {
		if(dom.type === 'radio' || dom.type === 'checkbox') {
			dom.checked && (obj[dom.name] = dom.value)
		}else if(dom.name) obj[dom.name] = dom.value
	})

	return obj
}

function whichFormShow (index) {
	if(index === 3) getPassenger()

	document.body.setAttribute('class' , 'form' + index)
}