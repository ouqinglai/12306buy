var _ctx = 'https://kyfw.12306.cn/otn/'
,	_module = { module : 'login' , rand : 'sjrand' }//图片验证码get请求参数
,	_baTime = '2016-11-15'//选往返程时用到，单程无用
,	_typeArray = {'M' : '一等座' , 'O' : '二等座' , '9' : '商务座' , '1' : '硬座' , '3' : '硬卧' , '4' : '软卧'}

/*辅助变量*/
var _tabId//返回给popup.html信息
,	_isBuyMode//bool模式，buy：立即下单，inquiry：询票当有票时立即下单
,	_initMsgBox = false
,	_is_buy_noSeat//bool是否要买无座票，用于显示
,	_can_noSeat//string,可选无座，当checked是为on否则为undefined
,	_clearTimeout//当用户又再一次提交询票时，清除已有的循环
,	_setTime//number,每隔多少s查询一次票
,	_noShowMsgBox = false//bool，让mosgBox消息框后台运行
,	_errorCount = 0//number,收集msgBox消息框错误提示次数
,	_plugin//object's method imgBase64 => check's Code
,	_isLoginFuncBind = false//login = login.bind(null , value)只执行一次

/*买票变量*/
var _randCode = ''
,	_secretStr//ticket string
,	_toTime//string出发日期
,	_type//string 'M'/*一等座*/ , 'O'/*二等座*/ , 9/*商务座*/
,	_from//array
,	_to//array
,	_ticketInfo//obj
,	_token
,	_passenger//string
,	_passengerStr//string
,	_time//array，['16:00'班次时间 , '[-1 , 1]'选取上下1小时内的最快班次]
,	_carId//火车型号G123
,	_start_time = ''//string，出发时间

window.onload = () => _plugin = document.querySelector('#pluginId')

chrome.runtime.onMessage.addListener(({ match , value } , { id }) => {
    _tabId = id

    if(match === 'userLogin'){
    	//放在最后执行，因为上面的login = login.bind(null , value)要判断是否已绑定value
    	if(!_isLoginFuncBind) {
    		_isLoginFuncBind = true
    		login = login.bind(null , value)
    	}
		window.clearTimeout(_clearTimeout)
    	_module = { module : 'login' , rand : 'sjrand' }
		start()
    }else if (match === 'orderInfo') {
		_randCode = ''
		_module = {
			module : 'passenger',
			rand : 'randp'
		}

		_from = value.from
		_to = value.to
		_toTime = value.to_date
		_time = [value.time , /*value.time_range*/]
		_type = value.type

		_passenger = value.name + ',1,'/*证件类型*/ + value.id/*身份证*/ + ','
		//O,0,1,xxx,1,440682199310213272,,N
		_passengerStr = _type + ',0,1,'/*0未知、1成人票*/ + _passenger + value.mobile + ',N'

		_isBuyMode = value.mode === 'buy'
		_can_noSeat = value.can_noSeat
		_setTime = value.loop || 10//默认10s 询票一次
		_noShowMsgBox = false
		
		window.clearTimeout(_clearTimeout)
		chrome.notifications.clear('needToBuy')
		chrome.notifications.clear('msgBox')

		queryTicket()
    }else if (match === 'iconClick') {
    	_noShowMsgBox = false
    }
})

chrome.notifications.onButtonClicked.addListener((id , btnIndex) => {
	chrome.notifications.clear(id)
	if(id === 'needToBuy') start()
	else if (id === 'msgBox') {
		if(btnIndex === 0) _noShowMsgBox = true
		else window.clearTimeout(_clearTimeout)
	}
})

chrome.notifications.onClosed.addListener((id , byUser) => {
	if(id === 'msgBox') _initMsgBox = false
})

//处理Provisional headers are shown请求
// chrome.webRequest.onBeforeRequest.addListener(
// 	({ url }) => ({ redirectUrl : url.replace(chrome.extension.getURL('') , 'http://check.huochepiao.360.cn/') }),
//     { urls: [chrome.extension.getURL('img_vcode')] },
//     ['blocking']
// )

//请求headers 添加Origin、Referer字段
chrome.webRequest.onBeforeSendHeaders.addListener(({ url , requestHeaders }) => {
		Array(
			'loginAysnSuggest',
			'submitOrderRequest',
			'queryX',
			'checkOrderInfo',
			'confirmSingleForQueue',
			'checkRandCodeAnsyn',
			'getPassCodeNew',
			'initDc',
			'login/init',
			'getPassengerDTOs',
			'initMy12306',
			'station_name'
		).some(apiName => {
			if(RegExp(apiName).test(url)) {
				console.log(url)
				return requestHeaders.push({
					name: 'Origin',
					value: 'https://kyfw.12306.cn'
				} , {
					name : 'Referer',
					value : 'https://kyfw.12306.cn/otn/index/init'
				})
			}
		})

		return { requestHeaders }
	},
	{urls: ['*://*/otn/*'] },
	['blocking' , 'requestHeaders']
)

//1、登录验证
function start (isReLogin/*bool用于重新登录*/){
	let cb = () => dataUrl(val => sendImg2Plugin(val , isReLogin))

	//删除BIGipServerotn cookie，则图片验证码只需识别一个物品，此时用于登录，
	//提交订单时的图片验证码一定是识别两个物品
	if(_module.module === 'login') {
		chrome.cookies.remove({
			url : 'https://kyfw.12306.cn/otn/passcodeNew/',
			name : 'BIGipServerotn',
		})
		
		Fetch('https://kyfw.12306.cn/otn/login/init' , null , cb , 'text')
	}else cb()
}

//2、验证成功后，登录
function login (userLogin , cb){
	Fetch(_ctx + 'login/loginAysnSuggest' , {
		'loginUserDTO.user_name' : userLogin.user,
		'userDTO.password' : userLogin.pwd,
		'randCode' : _randCode,
	} , () => {
		sendMsg(['loginCb'])

		sendMsg(['msgCb' , '登录成功！' , 'login' , false])

		cb && cb()
	})
}

//3、查票
function queryTicket (){
	//GET
	Fetch(_ctx + 'leftTicket/queryX?' + ObjStringData({//GET
		'leftTicketDTO.train_date':_toTime,
		'leftTicketDTO.from_station':_from[1],
		'leftTicketDTO.to_station':_to[1],
		'purpose_codes':'ADULT',
	}) , null , res => {
		if(_secretStr = selectTime(res.data)) orderTicket()
		else !_isBuyMode && (_clearTimeout = setTimeout(queryTicket , 1000 * _setTime/*多少秒查一次*/))
	})
}

//4、跳转到提交订单页面
function orderTicket (){
	Fetch(_ctx + 'leftTicket/submitOrderRequest' , {
		secretStr:_secretStr,
		train_date : _toTime,
		back_train_date:_baTime,
		tour_flag:'dc',
		purpose_codes:'ADULT',
		query_from_station_name:_from[0],
		query_to_station_name:_to[0],
	} , getTicketHtml)
}

//5、获取订单html
function getTicketHtml (){
	Fetch(_ctx + 'confirmPassenger/initDc' , {} , text => {
		_ticketInfo = JSON.parse(text.match(/var ticketInfoForPassengerForm.+\};/)[0].replace(/(var ticketInfoForPassengerForm=|\;)/g , '').replace(/\'/g , '"'))
		_token = text.match(/var globalRepeatSubmitToken.+\;/)[0].replace(/(.+\s|\'|\;)/g , '')

		let isTimeout = ((new Date(_toTime + ' ' + _start_time).getTime() - new Date(_toTime + ' ' + _time[0]).getTime()) / 1000 / 60) > 30/*大于30分钟时要询问用户是否还买票*/
		_isBuyMode && !isTimeout ? start() : createNotice()
	} , 'text')
}

//6、先询问一下
function ckeckOrderInfo (){
	Fetch(_ctx + 'confirmPassenger/checkOrderInfo' , {
		cancel_flag:2,//未知
		bed_level_order_num:'000000000000000000000000000000',
		passengerTicketStr:_passengerStr,
		oldPassengerStr:_passenger + '3_',
		tour_flag:'dc',
		randCode:_randCode,
		REPEAT_SUBMIT_TOKEN:_token,
	} , buy)
}

//7、下单
function buy (){
	setTimeout(() => {
		Fetch(_ctx + 'confirmPassenger/confirmSingleForQueue' , {
			passengerTicketStr:_passengerStr,
			oldPassengerStr:_passenger + '3_',
			randCode:_randCode,
			purpose_codes:_ticketInfo.purpose_codes,
			key_check_isChange:_ticketInfo.key_check_isChange,
			leftTicketStr:_ticketInfo.leftTicketStr,
			train_location:_ticketInfo.train_location,
			roomType:00,
			dwAll:'N',
			REPEAT_SUBMIT_TOKEN:_token,
		} , data => {
			sendMsg(['msgCb' , '下单状态' , JSON.stringify(data.data)])
			sendMsg(['errorCb'])
		})
	} , 500)
}

//验证图片结果是否正确
function checkCode (position , isReLogin){
	_randCode = position.replace(/[()]/g , '')

	Fetch(_ctx + 'passcodeNew/checkRandCodeAnsyn' , {
		randCode : _randCode,
		rand : _module.rand
	} , data => {
		if(data.data.msg === 'TRUE') {
			sendMsg(['msgCb' , _module.module + 'ing' , 'checkCode'])

			setTimeout(() => {
				if(_module.module === 'login') login(isReLogin ? orderTicket : '')
				else ckeckOrderInfo()
			} , 500)
		}
		else {
			_randCode = ''
			start(isReLogin)
		}
	})
}

//获取验证码图片
function dataUrl (cb){
	var d = new FileReader

	d.onload = () => cb(d.result.replace('data:image/jpeg;base64,' , ''))
	
	Fetch(_ctx + 'passcodeNew/getPassCodeNew?' + ObjStringData(_module) , null , res => d.readAsDataURL(res) , 'blob')
}

//获取验证码结果
function sendImg2Plugin (imgBase64 , isReLogin){
	// Fetch('/img_vcode' , JSON.stringify({
	// 	img_buf: imgBase64,
	// 	type: 'D',
	// 	logon: _module.module === 'login' ? 1 : 0,//1代表识别1个物品，0代表2个
	// 	check: _plugin.GetSig(imgBase64)
	// }) , ({ res }) => {
	// 	sendMsg(['msgCb' , 'code：' + res , '获取验证码结果'])
	// 	res ? checkCode(res , isReLogin) : start(isReLogin)
	// })

	/*XMLHttpRequest Origin 有效*/

	var xhr = new XMLHttpRequest
 
	xhr.open('POST' , 'http://check.huochepiao.360.cn/img_vcode?' + +new Date , true)

	// xhr.timeout = 3000

	xhr.setRequestHeader('Content-Type' , 'application/x-www-form-urlencoded')

	xhr.onreadystatechange = () => {
	    if (xhr.readyState == 4) {
	    	if(xhr.status == 200) {
	            let res = JSON.parse(xhr.responseText).res
	 
	            sendMsg(['msgCb' , 'code：' + res , '获取验证码结果'])

				res ? checkCode(res , isReLogin) : start(isReLogin)
	    	}else {
	    		console.log(xhr)
	    	}
	    }
	}

	xhr.send(JSON.stringify({
		img_buf: imgBase64,
		type: 'D',
		logon: _module.module === 'login' ? 1 : 0,//1代表识别1个物品，0代表2个
		check: _plugin.GetSig(imgBase64)
	}))
}

/*---辅助函数---*/
function ObjStringData (data) {
	return Object.keys(data).map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(data[key])).join('&')
}

function Fetch (url , data , cb , resType = 'json'){
	let count = 1
	,	other = {
		credentials: 'include',
		headers : {
			'Upgrade-Insecure-Requests' : 1//让loginAysnSuggest请求通过
		}
	}

	if(data) {
		other.method = 'POST'
		other.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8'

		if(typeof data === 'object') data = ObjStringData(data)

		other.body = data
	}else {
		other.headers['Cache-Control'] = 'no-cache'
	}

	ajax()
	function ajax (){
		fetch(url , other)
		.then(res => res[resType]())
		.then(res => {
			if(res.data && res.data.errMsg) {
				error(res.data.errMsg)
			}else if(res.messages && res.messages.length !== 0) {
				error(JSON.stringify(res.messages))
				if(res.messages.indexOf('用户未登录') !== -1) {
					_module = { module : 'login' , rand : 'sjrand' }
					start(true/*需要重新登录*/)
				}
			}else if(cb) cb(res)
		})
	}

	function error (msg){
		_noShowMsgBox = false
		sendMsg(['msgCb' , msg , url])
		sendMsg(['errorCb'])
	}
}

//向popup.html发送信息
function sendMsg ([match , value , funcName = '' , isAlwayShow = true]) {
	if(match === 'msgCb') {
		++_errorCount

		!_noShowMsgBox && chrome.notifications[_initMsgBox ? 'update' : 'create']('msgBox' , {
			type : 'basic',
			title : '提示' + _errorCount,
			message : value,
			contextMessage : funcName,
			iconUrl : 'logo.png',
			requireInteraction : isAlwayShow,//一直显示
			buttons : !_isBuyMode && funcName === 'selectTime' ? [{ title : '后台运行' } , { title : '停止' }] : [],
		} , () => _initMsgBox = true)
	}else {
		chrome.runtime.sendMessage(_tabId , {
	        match,
	        value,
	    })
	}
}

//询票成功，是否下单
function createNotice (){
	let _seat
	_ticketInfo.leftDetails.forEach((seat , index) => {
		if(seat.match(_typeArray[_type])) _seat = _ticketInfo.leftDetails[index]
	})

	_noShowMsgBox = false

	chrome.notifications.create('needToBuy' , {
		type : 'basic',
		title : _from[0] + ' 到 ' + _to[0] + `(${ _toTime })`,//广州南 到 北京西(日期)
		message : _is_buy_noSeat ? '(无座票!!!)' : _seat,//硬卧(426.00元)15张票
		iconUrl : 'logo.png',
		contextMessage : _carId + '   历时' + _lishi + '   出发时间' + _start_time,//火车型号G123  历时  出发时间
		requireInteraction : true,//一直显示
		buttons : [{ title : '立即购买' }],
	})
}

//选取规定时间内最快班次
function selectTime (data){
	let borderTime = Number(_time[0].replace(/:/ , ''))
	// ,	range = JSON.parse(_time[1])//array
	, 	str
	,	seat = ({
		'9' : 'swz_num',
		'M' : 'zy_num',
		'O' : 'ze_num',
		'1' : 'yz_num',
		'3' : 'yw_num',
		'4' : 'rw_num',
	})[_type]
	
	data.some(({ queryLeftNewDTO , secretStr }) => {
		if(borderTime <= Number(queryLeftNewDTO.start_time.replace(/:/ , ''))) {
			let bool1 = queryLeftNewDTO[seat] !== '无' && queryLeftNewDTO[seat] !== '--'
			,	bool2 = _can_noSeat && queryLeftNewDTO['wz_num'/*无座*/] !== '无'

			_start_time = queryLeftNewDTO.start_time
			if(bool1 || bool2) {
				_is_buy_noSeat = !bool1 && bool2

				str = secretStr
				_carId = queryLeftNewDTO.station_train_code
				_lishi = queryLeftNewDTO.lishi
			}

			return !_isBuyMode || (_isBuyMode && str) ? true : false//return true跳出some循环
		} 
	})

	if(str) return decodeURIComponent(str)
	else sendMsg(['msgCb' , (_isBuyMode ? `找不到或今天所有班次无票` : `${ _start_time }班次无票(${ _setTime }秒内重试)`) , 'selectTime'])
}