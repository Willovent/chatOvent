$(function(){
	 $("#frame").load(function() {
        var doc =  this.contentWindow;
        console.log(doc);
    });
})