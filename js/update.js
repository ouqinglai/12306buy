/*一天检测一次*/
var _date = (new Date).toLocaleDateString()

localStorage.getItem('updata_version') !== _date && chrome.management.getSelf(({ updateUrl , version }) => {
	fetch(updateUrl)
	.then(res => res.text())
	.then(res => {
		localStorage.setItem('updata_version' , _date)

		let new_version = res.match(new RegExp('</span>version<span.+</span>,</td>'))[0].match(/([\.\d]+)/)[0]

		if(version < new_version) {
			fetch(updateUrl.replace('manifest.json' , 'CHANGELOG.md'))
			.then(text => text.text())
			.then(text => {
				let changeLog = []

				text
				.match(new RegExp(`<\/a>${ new_version }<\/h2>(\\s\|\\S)+<\/ul>\\s<\/article>`))[0]
				.match(/<ul>\s(<li>.+<\/li>\s)+<\/ul>/)[0]
				.match(/<li>.+<\/li>/g)
				.forEach((li , index) => {
					changeLog.push({
						title : index + 1 + '.',
						message : li.replace(/(<li>|<\/li>)/g , '')
					})
				})
				
				chrome.notifications.create('' , {
					type: 'list',
			        title: `新版本${ new_version }升级提示！`,
			        message: `msg`,
			        iconUrl: './logo.png',
			        items: changeLog,
			        requireInteraction : true,//一直显示
				})
			})
		}
	})
})