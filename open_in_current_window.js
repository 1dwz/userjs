document.addEventListener('click', function(event) {
    // 检查点击的元素是否是链接或者在链接内部
    const link = event.target.closest('a');

    if (link) {
        // 获取链接的 href 属性
        const href = link.href;

        // 阻止默认的链接跳转行为
        event.preventDefault();

        // 在当前窗口打开链接
        window.location.href = href;
    }
});
