var url1 = 'https://kyfw.12306.cn/otn/'
,	user = JSON.parse(localStorage.USER || '{ "user" : "" , "pwd" : "" }')//user和pwd字段固定
,	stationName
,	isSelectStation = {
	_from : false,//出发地或目的地是否已选中值，false时不能提交form
	_to : false,
}
,	hook = [e => e.preventDefault() , (match , value) => {
	chrome.runtime.sendMessage({
        match,
        value,
    })
}]
,	$from = $('input[name="from"]')
,	$to = $('input[name="to"]')
,	$submit = $('#order_submit')

/* init */
$('[name="to_date"]').value = new Date().toLocaleDateString().replace(/\//g , '-')
$('[name="time"]').value = new Date().toTimeString().match(/\d+:\d+/)[0]

//读取12306账户信息
$('[name="user"]').value = user.user
$('[name="pwd"]').value = user.pwd

//check 12306 login
Fetch('index/initMy12306')
.then(res => {
	whichFormShow(res.url === url1 + 'index/initMy12306' ? 3 : 2)
})

//当错误提示框后台运行时，点击图标时让它再次显示
chrome.runtime.sendMessage({ match : 'iconClick' })

//获取车站对应编码
fetch(chrome.extension.getURL('js/stationName.txt'))
.then(res => res.text())
.then(res => {
	stationName = res

	isSelectStation = {
		_from : !!res.match($from.value),
		_to : !!res.match($to.value),
	}
})

/* eventBind */
$('#loginForm').onsubmit = e => {
	hook[0](e)

	hook[1]('userLogin' , formData(this))
}

$to.onblur = $from.onblur = function (){
	let $select = this.nextElementSibling

	if((new RegExp(`<li>${ this.value }<\/li>`)).test($select.outerHTML)) {
		isSelectStation['_' + this.getAttribute('name')] = true
	}
	setTimeout(() => {
		$select.style.display = 'none'
	} , 100)
}

$to.onkeyup = $to.onclick = $from.onkeyup = $from.onclick = function (e) {
	let _inputSelf = this
	,	val = _inputSelf.value
	,	inputName = _inputSelf.getAttribute('name')
	,	nextSelectDom = _inputSelf.nextElementSibling
	,	wrapperDom = document.createDocumentFragment()

	e.type !== 'click' && (isSelectStation['_' + inputName] = false)

	if(val) {
		nextSelectDom.innerHTML = '<span class="no-more">查找无效~</span>'

		let match = stationName.match(new RegExp(`\\|${ val }\\W*\\|` , 'g'))
		match && match.forEach(name => {
			let li = document.createElement('li')

			li.innerHTML = name.replace(/\|/g , '')
			li.onclick = function (){
				nextSelectDom.style.display = 'none'

				isSelectStation['_' + inputName] = true

				_inputSelf.value = this.innerHTML
			}

			wrapperDom.appendChild(li)
		})

		nextSelectDom.insertBefore(wrapperDom , nextSelectDom.childNodes[0])
		nextSelectDom.style.display = 'block'
	}
}

$('#order').onsubmit = e => {
	hook[0](e)

	if(!isSelectStation._from) return alert('出发地无效！')
	if(!isSelectStation._to) return alert('目的地无效！')

	let orderInfo = formData(this)
	,	{ from , to } = orderInfo

	orderInfo.from = findStationCode(from)
	orderInfo.to = findStationCode(to)
	orderInfo.user = user

	if(orderInfo.mode === 'buy') $submit.setAttribute('disabled' , '')

	hook[1]('orderInfo' , orderInfo)
}

chrome.runtime.onMessage.addListener(({ match , value }) => {
	if(match === 'loginCb') {
		localStorage.USER = JSON.stringify(value)
		whichFormShow(3)
	}else if (match === 'errorCb') {
		$submit.removeAttribute('disabled')
	}else if (match === 'loading') {
		$$forEach('button[type="submit"]' , dom => dom.classList.toggle('loading'))
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
			$submit.setAttribute('disabled' , '')
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

function $$forEach (selector , cb){
	[].forEach.call(document.querySelectorAll(selector) , cb)
}

function formData (form){
	let obj = {}

	$$forEach('[name]' , dom => {
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