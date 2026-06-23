<template>
  <div class="login-screen">
    <form class="login-card" @submit.prevent="handleSubmit">
      <div class="login-title" data-i18n="login.title">Bovin</div>
      <div class="login-sub" data-i18n="login.sub">面板登录</div>
      <label>
        <span data-i18n="login.username">用户名</span>
        <input v-model="username" type="text" autocomplete="username" required />
      </label>
      <label>
        <span data-i18n="login.password">密码</span>
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <button type="submit" class="primary" :disabled="loading" data-i18n="login.submit">
        <span v-if="loading">登录中...</span>
        <span v-else>登录</span>
      </button>
      <div v-if="error" class="login-error">{{ error }}</div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { postPanelAuthLogin } from "../../api/settings.js";
import { state, uiState, persistProfileToLocalStorage } from "../../store/state-core.js";
import { useRouter } from "vue-router";
import { enterShellAfterAuth } from "../../app.js";

const router = useRouter();
const username = ref(state.username || "freqtrader");
const password = ref(state.password || "tiger123");
const loading = ref(false);
const error = ref("");

onMounted(() => {
  if (state.username) {
    username.value = state.username;
  }
  if (state.password) {
    password.value = state.password;
  }
});

const handleSubmit = async () => {
  loading.value = true;
  error.value = "";
  
  try {
    const u = username.value.trim();
    const p = password.value;
    
    state.username = u;
    state.password = p;
    
    await postPanelAuthLogin({ username: u, password: p });
    
    localStorage.setItem("ft_panel_auth", "1");
    uiState.authed = true;
    persistProfileToLocalStorage();
    
    setTimeout(() => {
      enterShellAfterAuth();
      const currentRoute = router.currentRoute.value;
      if (currentRoute.name === "login") {
        const lastSection = localStorage.getItem("ft_active_section") || "overview";
        router.push({ name: lastSection }).then(() => {
          console.log("[Login] Navigation successful to:", lastSection);
        }).catch(err => {
          console.error("[Login] Navigation error:", err);
          router.push({ name: "overview" });
        });
      } else {
        console.log("[Login] Already on non-login route, staying");
      }
    }, 0);
    
  } catch (ex) {
    error.value = ex?.message || "登录失败";
    uiState.authed = false;
    try {
      localStorage.removeItem("ft_panel_auth");
    } catch {
      /* ignore */
    }
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: var(--surface);
  background-image:
    radial-gradient(circle at 15% 0%, rgba(87, 130, 255, 0.22), transparent 36%),
    radial-gradient(circle at 95% 100%, rgba(41, 223, 178, 0.1), transparent 40%);
  background-repeat: no-repeat;
  background-size: 100vw 100dvh;
  background-attachment: fixed;
}

.login-card {
  background: var(--ft-login-surface);
  border-radius: 20px;
  padding: 32px;
  width: min(400px, 90vw);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(var(--ft-line-rgb), 0.25);
}

.login-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary);
  text-align: center;
  margin-bottom: 4px;
}

.login-sub {
  font-size: 14px;
  color: var(--text-dim);
  text-align: center;
  margin-bottom: 28px;
}

.login-card label {
  display: block;
  margin-bottom: 16px;
}

.login-card label span {
  display: block;
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 8px;
}

.login-card input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(var(--ft-line-rgb), 0.35);
  border-radius: 10px;
  background: rgba(var(--ft-deep-rgb), 0.6);
  color: var(--text);
  font-size: 14px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.login-card input:focus {
  outline: none;
  border-color: rgba(var(--ft-accent-rgb), 0.76);
  box-shadow: 0 0 0 2px rgba(var(--ft-accent-rgb), 0.18);
}

.login-card button {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #4a7dff, #2d5eff);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.login-card button:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.login-card button:active:not(:disabled) {
  transform: translateY(0);
}

.login-card button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-error {
  margin-top: 14px;
  padding: 10px 14px;
  background: rgba(255, 82, 82, 0.1);
  border: 1px solid rgba(255, 82, 82, 0.3);
  border-radius: 8px;
  color: #ff5252;
  font-size: 13px;
  text-align: center;
}
</style>
