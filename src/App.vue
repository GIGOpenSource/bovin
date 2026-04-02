<template>
  <a-config-provider :theme="antdTheme">
    <router-view />
  </a-config-provider>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { theme } from "ant-design-vue";

const isLight = ref(false);

function syncThemeFromDom() {
  isLight.value = document.documentElement.getAttribute("data-theme") === "light";
}

onMounted(() => {
  syncThemeFromDom();
  window.addEventListener("bovin-theme-changed", syncThemeFromDom);
});

onUnmounted(() => {
  window.removeEventListener("bovin-theme-changed", syncThemeFromDom);
});

const antdTheme = computed(() => {
  const light = isLight.value;
  return {
    algorithm: light ? theme.defaultAlgorithm : theme.darkAlgorithm,
    token: {
      colorPrimary: "#26a69a",
      borderRadius: 10,
      fontSize: 13,
      controlHeight: 40
    },
    components: {
      Select: {
        optionSelectedBg: "rgba(38, 166, 154, 0.22)",
        optionActiveBg: "rgba(138, 180, 255, 0.12)",
        optionSelectedColor: "rgba(232, 240, 255, 0.98)",
        selectorBg: light ? undefined : "rgba(14, 22, 44, 0.92)",
        /* 与 shell.css 中 input:focus 边框色一致 */
        activeBorderColor: light ? "rgba(64, 102, 214, 0.76)" : "rgba(122, 159, 255, 0.76)",
        hoverBorderColor: "rgba(138, 180, 255, 0.45)"
      }
    }
  };
});
</script>

<style lang="less"></style>
