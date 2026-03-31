<template>
<section id="api" class="section">
          <div class="ft-page api-page">
            <header class="ft-page-hero">
              <div class="ft-page-hero__intro">
                <span class="ft-page-hero__kicker" data-i18n="page.kicker.api"></span>
                <h1 class="ft-page-hero__title" id="apiPageHeading" data-i18n="page.title.api"></h1>
                <p class="ft-page-hero__desc" data-i18n="page.desc.api"></p>
              </div>
            </header>
            <div class="card api-page-card" aria-labelledby="apiPageHeading">
            <h3 class="card-subtitle" data-i18n="panel.apiCatalog">服务端接口功能清单（与 REST API 对齐）</h3>
            <table class="data-table">
              <thead>
                <tr><th data-i18n="th.category">分类</th><th data-i18n="api.th.method">方法</th><th data-i18n="api.th.endpoint">路径</th><th data-i18n="th.description">说明</th></tr>
              </thead>
              <tbody id="endpointTable"></tbody>
            </table>
            </div>
            <div class="card api-page-card">
            <h3 class="card-subtitle" data-i18n="panel.actionResult">调用结果</h3>
            <div id="actionLog" class="log"></div>
            </div>
          </div>
        </section>
</template>

<style scoped>
/* api */
</style>

<script>
export * from "../../api/api.js";
</script>
