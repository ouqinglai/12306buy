chrome.tabs.query({ active : true } , ([{ id , url , index }]) => {
	if(/(tmall|taobao).com\/(item|home).htm/.test(url)) {
        let itemID
        ,   cb = $1 => itemID = $1

        url.replace(/[^pv]id=\d+/ , cb)

        url.replace(/item_id=\d+/ , cb)

        itemID.replace(/\d+/ , cb)

        getShortURL = getShortURL.bind(null , id)

        getCoupons(itemID)

        makeBtn.createTabIndex = index
    }else {
        sendMsg('此页面非天猫或淘宝的商品详情页！')
    }
})

//获取优惠券
function getCoupons (itemID){
	Fetch(`http://s.etao.com/detail/${ itemID }.html` , null , text => {
		text.replace(/(seller|userNum)Id=(\d+)/ , ($1 , $2 , $3) => {
			makeFeeBtn(itemID , $3)

			Promise.all([
				//固定：两个fetch上下顺序
				//因为：先将购物车的优惠券加进idArray数组，再判断其他是否隐藏券
				Fetch('https://cart.taobao.com/json/GetPriceVolume.do' , { sellerId : $3 }),
				Fetch(`http://zhushou3.taokezhushou.com/api/v1/coupons_base/${ $3 }` , { item_id : itemID }),
			])
			.then(([{ priceVolumes } , { data }]) => {
				let coupons = []
				,	idArray = []
				,	fetchList = []

				priceVolumes.concat(data).forEach(({ activity_id , id , title }) => {
					let couponURL = `http://shop.m.taobao.com/shop/coupon.htm?seller_id=${ $3 }&activity_id=${ activity_id || id }`

					if(idArray.indexOf(couponURL) === -1) {
						idArray.push(couponURL)
						coupons.push({ isHidden : title ? false : true })
						fetchList.push(Fetch(couponURL , 0 , 0 , 'text'))
					}
				})	

				Promise.all(fetchList)
				.then(([...textList]) => {
					textList.forEach((text , index) => {
						Object.assign(coupons[index] , {
							array : text.match(/<dl>(\s|\S)+<\/dl>/)[0].match(/((\d+元优惠券)|(满(\d|\.)+)|(限领\d*)|(有效期.+\d))/g),
							url : idArray[index]
						})
					})

					makeBtn(coupons)
				})		
			})
		})
	} , 'text')
}

//生成button按钮
function makeBtn (coupons){
	coupons.forEach(({ array , url , isHidden } , index) => {
		if(index === coupons.length - 1) newBtnEle.status = 'end'

		newBtnEle(
			`${ array[1] }减${ array[0].match(/\d+/)[0] }  [${ array[2] }张${ isHidden ? ' , 隐' : '' }]<br>${ array[3] }`,
			() => chrome.tabs.create({
				url,
				index : makeBtn.createTabIndex + 1,
			})
		)
	})
}
//获取通用佣金、定向佣金、鹊桥佣金，并生成按钮
function makeFeeBtn (itemID , sellerID){
	Promise.all([
		Fetch(['shopdetail/campaigns'] , { oriMemberId : sellerID }),
		Fetch(['items/search'] , { q : 'https://item.taobao.com/item.htm?id=' + itemID }),
		Fetch('http://zhushou.taokezhushou.com/api/v1/queqiaos/' + itemID)
	])
	.then(([{ data : dingxiang } , { data : { pageList : tongyong } } , { data : queqiaos }]) => {
		let { tkRate , auctionId , zkPrice , tkSpecialCampaignIdRateMap } = tongyong ? tongyong[0] : []
		,	IDArray = ['auctionid' , auctionId]
		,	$loading = document.querySelector('.loading')

		dingxiang && dingxiang.campaignList.forEach(({ properties , campaignId , shopKeeperId }) => {
			if(properties === 1 && campaignId !== 0)
				newBtnEle(`定向${ calc(tkSpecialCampaignIdRateMap[campaignId]) }` , () => getDingXiangURL({
					campId : campaignId,
					keeperid : shopKeeperId,
					sellerID,
				}))
		})

		queqiaos && queqiaos.forEach(({ final_rate , left_day }) => {
			//剩余天数为0去掉
			left_day && newBtnEle(`鹊桥${ calc(final_rate) }` , () => getShortURL(IDArray.concat({
				scenes : 3,
				channel : 'tk_qqhd',
			})))
		})

		if(tongyong) {
			newBtnEle.status = 'before'
			newBtnEle(`通用${ calc(tkRate) }` , () => getShortURL(IDArray))
		}else if (document.body.firstElementChild === $loading) {
			$loading.innerHTML = '无佣金活动'
		}

		function calc (rate){
			return `(${ zkPrice } * ${ rate }% = ${ (zkPrice * rate / 100).toFixed(2) })`
		}
	})
}

//定向佣金
function getDingXiangURL ({ campId , keeperid , sellerID }){
	sendMsg('重定向到店铺首页，请手动进入商品')

	Fetch(['pubauc/applyForCommonCampaign' , 'POST'] , {
		_tb_token_ : '7kYCHxQ2Y9q',//required
		applyreason : '手动点赞~  ' + new Date().toLocaleTimeString(),
		keeperid,
		campId,
	} , () => getShortURL(['orimemberid' , sellerID]))
}

//获取短链接，公用方法
function getShortURL (tabID , [IDName , ID , otherObj = { scenes : 1 }]){
	getSomeID(tabID , (IDObj , cb) => {
        Fetch(
        	[`common/code/${ IDName === 'auctionid' ? 'getAuctionCode' : 'getShopCode' }`],
        	Object.assign(
        		{ [IDName] : ID },
        		IDObj,
        		otherObj
        	),
        	cb
        )
	})
}

//获取广告位信息
function getSomeID (tabID , cb){
	Fetch(['common/adzone/newSelfAdzone2'] , { tag : '29' } , ({ data : { otherAdzones , otherList } }) => {
		otherAdzones = otherAdzones[0]
        otherList = otherList[0].memberid

        cb({
        	adzoneid : otherAdzones.sub[0].id,
        	siteid : otherAdzones.id,
        } , ({ data : { shortLinkUrl } }) => {
            chrome.tabs.update(tabID , {'url' : shortLinkUrl})
        })
	})
}

function newBtnEle (text , clickCb){
	let btn = document.createElement('button')
	,	{ wrapper , status } = newBtnEle

	if(!wrapper) wrapper = newBtnEle.wrapper = document.createDocumentFragment()

	btn.innerHTML = text
	btn.onclick = clickCb

	wrapper.appendChild(btn)

	if(status) {
		if(status === 'end') document.body.appendChild(wrapper)
		else document.body.insertBefore(wrapper , document.body.firstChild)

		newBtnEle.wrapper = newBtnEle.status = null
	}
}

function ObjStringData (data) {
    return data ? '?' + Object.keys(data).map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(data[key])).join('&') : ''
}

function Fetch (api , data , cb , responseType = 'json'){
	let bool = api.length !== 2
	,	newData = ObjStringData(data)
	,	option = {
        credentials: 'include',
        headers : { 'Cache-Control' : 'no-cache' },
        method : bool ? 'GET' : 'POST'
	}

	if(!bool) {
		option.body = newData.slice(1)
		option.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8'
	}

    let promise = fetch((typeof api === 'string' ? api : `http://pub.alimama.com/${ api[0] }.json`) + (bool ? newData : '') , option)
    .then(res => res[responseType]())
    .catch(error => sendMsg('请重新登录阿里妈妈或刷新页面!'))
    
    if(cb) promise.then(res => cb(res))

    return promise
}

function sendMsg (msg) {
    new Notification(msg , {
        icon : './logo.png'
    })
}