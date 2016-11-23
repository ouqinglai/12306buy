var LOGIN = $('#loginForm')
,	ORDER = $('#order')
,	YUNDAMA = $('#damaForm')
,	url1 = 'https://kyfw.12306.cn/otn/'
,	url2 = 'http://www.yundama.com/'
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

$('#code_img').onclick = function (){
	this.src = this.src + '?r=' + +new Date
}
$('.change-dama').onclick = () => whichFormShow(1)

if(localStorage['dama']) {
	fetch(url1 + 'index/initMy12306' , { credentials: 'include' })
	.then(res => {
		whichFormShow(res.url === url1 + 'index/initMy12306' ? 3 : 2)
	})
}else {
	whichFormShow(1)
}

//当错误提示框后台运行时，点击图片时让它再次显示
chrome.runtime.sendMessage({ match : 'iconClick' })

//获取车站对应编码
fetch(url1 + 'resources/js/framework/station_name.js?station_version=1.8971' , { credentials: 'include' })
.then(res => res.text())
.then(res => stationName = res)

/* eventBind */
YUNDAMA.onsubmit = function (e) {
	hook[0](e)
	
	let obj = formData(this)

	fetch(url2 + 'index/login?' + objStringData(obj) , { credentials: 'include' })
	.then(res => res.json())
	.then(res => {
		if(res.ret === 0) {
			whichFormShow(2)
			hook[1]('damaLogin' , obj)
			localStorage['dama'] = true
		}
		else {
			new Notification(res.msg , { icon : 'logo.png' })
			$('#code_img').click()
			$('[name="vcode"').value = ''
		}
	})
}

LOGIN.onsubmit = function (e) {
	hook[0](e)
	hook[1]('userLogin' , formData(this))
}

ORDER.onsubmit = function (e) {
	hook[0](e)

	let orderInfo = formData(this)
	,	{ from , to } = orderInfo

	orderInfo.from = findStationCode(from)
	orderInfo.to = findStationCode(to)

	if(orderInfo.mode === 'buy') ORDER.setAttribute('disabled' , '')

	hook[1]('orderInfo' , orderInfo)
}

chrome.runtime.onMessage.addListener(({ match , value }) => {
	if(match === 'loginCb') {
		whichFormShow(3)
	}else if (match === 'errorCb') {
		ORDER.removeAttribute('disabled')
	}
})

/* helper */
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
	document.body.setAttribute('class' , 'form' + index)
}

function objStringData (data) {
	return Object.keys(data).map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(data[key])).join('&')
}