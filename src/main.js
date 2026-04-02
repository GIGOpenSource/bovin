import { createApp } from "vue";
import Antd from "ant-design-vue";
import App from "./App.vue";
import router from "./router";
import { store } from "./store";
import { stripSensitiveQueryParamsFromUrl } from "./utils/strip-sensitive-url-params.js";
import "ant-design-vue/dist/reset.css";
import "./style/index.less";
import "./style/antd-panel.less";

stripSensitiveQueryParamsFromUrl();

const app = createApp(App);
app.use(store);
app.use(router);
app.use(Antd);
app.mount("#app");
