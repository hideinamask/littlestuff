// 处理html格式成为需要的目标对象
function parserHtmlStringToResultList(htmlString){
    var patt1 = /data-asin="[A-Z0-9]+" [\s\S]*?<\/h2>/g;
    var itemList = new Array;
    //综上可知， 使用g全局搜索的时候，我们可以使用循环
    do{
        var res = patt1.exec(htmlString);
        if(res != null){
            if(res[0]){
               var asin, sponsored;
               asin = /data-asin="([A-Z0-9]+)"/.exec(res[0])[1];
               sponsored = !!(/Sponsored/.exec(res[0]));
               itemList.push({ asin:asin, sponsored:sponsored });
            }
        }
    }while(res != null);
    return itemList;
}

// 生成Promise对象
function generatePromiseObj(url, type, param, index){
    return new Promise(function(resolve, reject) {
        $.ajax({
            url:url,
            type:type,
            data:param,
            success:function(data){
                var obj = { itemList:parserHtmlStringToResultList(data), index:index };
                resolve(obj);
            }
        });
    });
}

// 获取排名数据
function getRanks(ASIN, searchwords, callback){
    var url = getBaseUri() + "/s";
    var num, param, total = 7;
    var promises = new Array;

    for(num = 1; num <= total; num++){
        param = {
            k:searchwords,
            page : num,
            ref:"sr_pg_" + num
        };
        promises.push(generatePromiseObj(url, "GET", param, num));
    }
    
    // 统一处理返回结果
    Promise.all(promises).then(results => {
        // 排序处理
        results = results.sort((item1, item2)=>{
            return item1.index - item2.index;
        });

        // 得到目标数组
        var totalItemList = new Array;
        for(var i = 0; i < results.length; i++){
            totalItemList = totalItemList.concat(results[i].itemList);
        }
        // console.log(results);

        // 开始匹配排位
        var naturalRank, adRank;
        naturalRank = adRank = 0;
        for(var i = 0; i < totalItemList.length; i++){
            if(totalItemList[i].asin == ASIN && totalItemList[i].sponsored === false && !naturalRank){
                naturalRank = i + 1;
            }
            if(totalItemList[i].asin == ASIN && totalItemList[i].sponsored === true && !adRank ){
                adRank = i + 1;
            }
        }
        
        var rankObj = { searchwords:searchwords, naturalRank:naturalRank, adRank:adRank };
        try{
            var amountPerPage = results[0].itemList.length;
            rankObj.amountPerPage = amountPerPage;
        }catch(e){
            console.log(e);
        }


        callback(rankObj);
    }).catch(reason => {
        console.log('reason:',reason)
    });
}


// 获取产品详细信息
// ASIN, callback回调函数
function getProductInfomation(ASIN, callback){
    $.ajax({
        url:getBaseUri() + "/dp/" + ASIN,
        type:"GET",
        success:function(data){
            var ratingAmount, ratingLevel, hasImageReviews, qaAmount, batRatingsRate, currentPrice, couponIsRunning;
            ratingAmount = ratingLevel = hasImageReviews = qaAmount = batRatingsRate = currentPrice = couponIsRunning = 0;

            try{
                ratingAmount = /([0-9]+) ratings/.exec(data)[1];
                // console.log(ratingAmount);
            }catch(e){
            }

            try{
                ratingLevel = /acrPopover[\s\S]*?([0-9\.]+) out of 5 stars/.exec(data)[1];
                // console.log(ratingLevel);
            }catch(e){
            }

            try{
                hasImageReviews = /reviews-image-gallery-container/.exec(data) ? 1 : 0;
                // console.log(hasImageReviews);
            }catch(e){
            }

            try{
                qaAmount = /([0-9]+) answered questions/.exec(data)[1];
                // console.log(qaAmount);
            }catch(e){
            }

            try{
                currentPrice = /"priceblock_ourprice".*?([0-9\.]+)/.exec(data)[1];
                // console.log(currentPrice);
            }catch(e){
            }

            try{
                couponIsRunning = /couponBadge/.exec(data) ? 1 : 0;
                // console.log(couponIsRunning);
            }catch(e){
            }

            // 搜索首页评论星级
            var ratingsFindingPattern = /customer_review[\s\S]*?([0-9\.]+) out of 5 stars/g;
            var ratingsTotal, batRatings;
            ratingsTotal = batRatings = 0;
            try{
                do{
                    var res = ratingsFindingPattern.exec(data);
                    if(res != null){
                        if(res[1]){
                           ratingsTotal += 1;
                           // console.log(res[1] <= 3);
                           batRatings += (res[1] <= 3 ? 1 : 0);
                        }
                    }
                }while(res != null);
                batRatingsRate = batRatings / ratingsTotal;
            }catch(e){
            }
            batRatingsRate = (batRatingsRate * 100).toFixed(2) + "%";
            // console.log(batRatingsRate);

            callback({
                ratingAmount:ratingAmount,
                ratingLevel:ratingLevel,
                hasImageReviews:hasImageReviews,
                qaAmount:qaAmount,
                currentPrice:currentPrice,
                couponIsRunning:couponIsRunning,
                batRatingsRate:batRatingsRate
            });
        }
    });
}

// 获取基础uri地址  选取域名
function getBaseUri(){
    return window.location.protocol+"//"+window.location.host;
}


importJS("jquery.js","https://libs.baidu.com/jquery/2.1.4/jquery.min.js",function(){
    var textString = prompt("请输入匹配ASIN和目标关键词（以|隔开）");
    if(textString && textString.length > 0){
        var textArr = textString.split("|");
        if(textArr && textArr.length == 2){
            getProductInfomation(textArr[0], function(info){
                getRanks(textArr[0], textArr[1], function(rank){
                    var showText = "";
                    showText += "当前价格：" + info.currentPrice + "\n";
                    showText += "Rating数量：" + info.ratingAmount + "\n";
                    showText += "Rating级别：" + info.ratingLevel + "\n";
                    showText += "是否有图片评论：" + (info.hasImageReviews > 0 ? "有" : "无") + "\n";
                    showText += "QA数量：" + info.qaAmount + "\n";
                    showText += "首页差评率（1-3星）：" + info.batRatingsRate + "\n";
                    showText += "Coupon运行中：" + (info.couponIsRunning > 0 ? "是" : "否") + "\n";
                    showText += "关键词：" + rank.searchwords + "\n";
                    showText += "自然排名：" + rank.naturalRank + " 广告排名：" + rank.adRank + (rank.hasOwnProperty("amountPerPage") ? " 每页条数：" + rank.amountPerPage : "");
                    alert(showText);
                });
            });
        }
    }else{
        alert("请输入查询数据");
    }
});
