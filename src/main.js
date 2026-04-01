import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { store } from "./store";
import { stripSensitiveQueryParamsFromUrl } from "./utils/strip-sensitive-url-params.js";
import "./style/index.less";

stripSensitiveQueryParamsFromUrl();

const app = createApp(App);
app.use(store);
app.use(router);
app.mount("#app");
