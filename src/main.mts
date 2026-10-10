import type {Chart as ChartInstance} from "chart.js";
import languageColors from "./languages.json" with {type: "json"};

declare const Chart: typeof import("chart.js/auto").default;

const languageColorsByName: Record<string, string> = languageColors;

interface LanguageMap {
    [language: string]: number;
}

let chart: ChartInstance<"pie", number[], string> | null = null;

const form = document.getElementById("search-form") as HTMLFormElement;
const userNameInput = document.getElementById("username-input") as HTMLInputElement;
const tokenInput = document.getElementById("token-input") as HTMLInputElement;
const repoLimitInput = document.getElementById("repo-limit-input") as HTMLInputElement;
const repoLimitMax = document.getElementById("repo-limit-max") as HTMLSpanElement;
const btn = document.getElementById("search-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const resultEl = document.getElementById("result") as HTMLElement;
const listEl = document.getElementById("lang-list") as HTMLUListElement;
const titleEl = document.getElementById("user-title") as HTMLHeadingElement;

/**
 * 获取速率限制的错误。
 *
 * 如果可以，错误消息中会带上速率重置时间。
 * @param response 响应实例
 * @return Error 错误实例
 */
function getRateLimitError(response: Response): Error {
    const resetTimestamp = Number(response.headers.get("x-ratelimit-reset"));
    if (resetTimestamp > 0) {
        const resetTime = new Date(resetTimestamp * 1000).toLocaleString();
        return new Error(`API 速率限制已达上限，将于 ${resetTime} 重置。`);
    }
    return new Error("API 速率限制已达上限，请稍后再试。");
}

async function fetchLanguages(username: string, token: string, maxRepos: number | null): Promise<LanguageMap> {
    const apiHeaders: Record<string, string> = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "ghlp",
    };
    if (token) {
        apiHeaders["Authorization"] = `Bearer ${token}`;
    }

    // 获取仓库 languages_url
    let reposUrl: string | null = `https://api.github.com/users/${
        encodeURIComponent(username)
    }/repos?per_page=100`;
    const repos: Array<{ languages_url: string }> = [];
    while (reposUrl) {
        const repoResponse = await fetch(reposUrl, { headers: apiHeaders });
        switch (repoResponse.status) {
            case 404:
                throw new Error(`找不到用户 "${username}"。`);
            case 403:
            case 429:
                throw getRateLimitError(repoResponse);
            default:
                if (!repoResponse.ok) {
                    throw new Error(`获取用户仓库信息失败（HTTP ${repoResponse.status}）`);
                }
        }

        const pageRepos = (await repoResponse.json()) as Array<{ languages_url: string }>;
        if (maxRepos === null) {
            repos.push(...pageRepos);
        } else {
            repos.push(...pageRepos.slice(0, maxRepos - repos.length));
        }
        const nextUrl = repoResponse.headers.get("Link")?.match(/<([^>])>;\s*rel="next"/);
        reposUrl = nextUrl?.[1] ?? null;
    }

    // 获取各语言字节数
    const totals: LanguageMap = {};
    for (const { languages_url } of repos) {
        const languageResponse = await fetch(languages_url, { headers: apiHeaders });
        switch (languageResponse.status) {
            case 403:
            case 429:
                throw getRateLimitError(languageResponse);
            case 451:
                continue;
            default:
                if (!languageResponse.ok) {
                    throw new Error(`获取仓库语言信息失败（HTTP ${languageResponse.status}）`);
                }
        }
        const languages = (await languageResponse.json()) as LanguageMap;
        for (const [name, bytes] of Object.entries(languages)) {
            totals[name] = (totals[name] ?? 0) + bytes;
        }
    }

    return totals;
}

/**
 * 返回一个后备颜色。
 * @param language 语言名称
 */
function fallbackColor(language: string): string {
    let hash = 0;
    for (let i = 0; i < language.length; i++) {
        hash = (hash * 31 + language.charCodeAt(i)) >>> 0;
    }
    return `hsl(${hash % 360}, 65%, 55%)`;
}

/**
 * 获取指定语言的颜色，没有则返回后备颜色。
 * @param language 语言名称
 */
function getColor(language: string): string {
    return languageColorsByName[language] ?? fallbackColor(language);
}

/**
 * 渲染结果。
 * @param langMap 语言数据
 * @param username 用户名
 */
function render(langMap: LanguageMap, username: string): void {
    const entries = Object.entries(langMap).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
        showStatus("没有语言结果", "error");
        resultEl.hidden = true;
        return;
    }

    const totalBytes = entries.reduce((sum, [, v]) => sum + v, 0);
    const labels = entries.map(([name]) => name);
    const data = entries.map(([, bytes]) => bytes);
    const colors = labels.map(getColor);

    // I will kill.
    // I will destroy the world.
    // No matter what you do, I don't stop.
    // I'm the only one is right.
    // ---- 削除射线 --->
    chart?.destroy();
    chart = new Chart(
        document.getElementById("lang-chart") as HTMLCanvasElement, {
            type: "pie",
            data: {
                labels,
                datasets: [
                    {
                        data,
                        backgroundColor: colors,
                        borderColor: "#161b22",
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const pct = ((ctx.parsed / totalBytes) * 100).toFixed(1);
                                return ` ${ctx.label}：${pct}%（${ctx.parsed.toLocaleString()} 字节）`;
                            },
                        },
                    },
                },
            },
        },
    );

    titleEl.textContent = `${username} 的语言构成（共 ${totalBytes.toLocaleString()} 字节）`;
    listEl.innerHTML = entries.map(
        ([name, bytes]) => {
            const percent = ((bytes / totalBytes) * 100).toFixed(2);
            return `<li class="lang-item">
        <span class="lang-dot" style="background:${getColor(name)}"></span>
        <span class="lang-name">${name}</span>
        <span class="lang-pct">${percent}%</span>
      </li>`;
        },
    ).join("\n");

    resultEl.hidden = false;
}

/**
 * 显示状态消息，并应用对应消息类别的样式。
 * @param message 需要显示的消息内容
 * @param type 消息的类别
 */
function showStatus(message: string, type: "loading" | "error"): void {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`; // 见 Scss
    statusEl.hidden = false;
}

/**
 * 隐藏状态消息。
 */
function hideStatus(): void {
    statusEl.hidden = true;
}

/**
 * 更新最大统计仓库数输入框限制。
 */
function updateRepoLimit(): void {
    const rateLimit = tokenInput.value.trim() ? 5000 : 60;
    repoLimitInput.max = String(rateLimit);
    repoLimitMax.textContent = rateLimit.toLocaleString();
}

tokenInput.addEventListener("input", updateRepoLimit);

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = userNameInput.value.trim();
    const token = tokenInput.value.trim();
    const limitValue = repoLimitInput.value.trim();
    const maxRepos = limitValue ? Number(limitValue) : null;
    if (!username) return;
    if (
        (maxRepos !== null) &&
        (!Number.isInteger(maxRepos) || maxRepos < 1 || maxRepos > Number(repoLimitInput.max))
    ) {
        // 不合理的最大统计仓库数
        return;
    }

    btn.disabled = true;
    btn.textContent = "获取中…";
    resultEl.hidden = true;
    showStatus(
        `正在获取 ${username} 的仓库语言信息${maxRepos === null ? "" : `（最多 ${maxRepos} 个仓库）`}…`,
        "loading",
    );

    try {
        const langMap = await fetchLanguages(username, token, maxRepos);
        hideStatus();
        render(langMap, username);
    } catch (error) {
        resultEl.hidden = true;
        showStatus(error instanceof Error ? error.message : "未知错误", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "查询";
    }
});
