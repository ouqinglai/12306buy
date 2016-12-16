/*一天检测一次*/
var _date = (new Date).toLocaleDateString()

localStorage.getItem('updata_version') !== _date && chrome.management.getSelf(({ updateUrl , version }) => {
	fetch(updateUrl)
	.then(res => res.text())
	.then(res => {
		localStorage.setItem('updata_version' , _date)

		let new_version = res.match(new RegExp('</span>version<span.+</span>,</td>'))[0].match(/([\.\d]+)/)[0]

		if(version < new_version) {
			new Notification('升级提示！' , {
				icon : './logo.png',
				body : `有新版本${ new_version }更新`,
			})
		}
	})
})