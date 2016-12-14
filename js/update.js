/*一天检测一次*/
var _date = (new Date).toLocaleDateString()

localStorage.getItem('updata_version') !== _date && fetch('https://github.com/ouqinglai/12306buy/blob/taobaobuy/manifest.json')
.then(res => res.text())
.then(res => {
	localStorage.setItem('updata_version' , _date)

	let version = res.match(new RegExp('</span>version<span.+</span>,</td>'))[0].match(/([\.\d]+)/)[0]

	chrome.management.getSelf(_self => {
		if(_self.version < version) {
			new Notification('升级提示！' , {
				icon : './logo.png',
				body : `有新版本${ version }更新`,
			})
		}
	})
})