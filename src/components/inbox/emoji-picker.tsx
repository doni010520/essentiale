"use client";

import { useState } from "react";

// Conjunto curado de emojis por categoria (suficiente para atendimento).
const CATEGORIES: { key: string; icon: string; emojis: string[] }[] = [
  {
    key: "Rostos",
    icon: "😀",
    emojis: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😴 😪 🤤 😷 🤒 🤕 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 😤 😡 😠 🤬 😈".split(" "),
  },
  {
    key: "Gestos",
    icon: "👍",
    emojis: "👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👋 🤚 🖐️ ✋ 🖖 👏 🙌 👐 🤲 🙏 🤝 💪 🦾 👊 ✊ 🤛 🤜 ✍️ 💅 🤳".split(" "),
  },
  {
    key: "Amor",
    icon: "❤️",
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 😻 💋".split(" "),
  },
  {
    key: "Objetos",
    icon: "🎉",
    emojis: "🎉 🎊 🎈 🎁 🏆 🥇 ✅ ❌ ⭐ 🌟 ✨ 🔥 💯 💢 💥 💦 💨 🕐 ⏰ 📅 📌 📎 🔒 🔑 💰 💵 💳 📈 📉 📊 📱 💻 ⌨️ 🖥️ 📞 ☎️ 📧 ✉️ 📦 🛒 🛍️ 🔔 🔕 ⚠️ ❓ ❗ 💡 🎯".split(" "),
  },
  {
    key: "Símbolos",
    icon: "👌",
    emojis: "✔️ ➡️ ⬅️ ⬆️ ⬇️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🔝 🆗 🆕 🆒 💲 ©️ ®️ ™️ 〽️ ➕ ➖ ✖️ ➗ 💠 🔘 🔹 🔸".split(" "),
  },
  {
    key: "Comida",
    icon: "🍕",
    emojis: "☕ 🍺 🍻 🥂 🍷 🍕 🍔 🍟 🌭 🍿 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 🍎 🍌 🍇 🍉 🍓 🥑 🍞 🧀 🍗 🍖".split(" "),
  },
];

export function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const [cat, setCat] = useState(0);
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute bottom-12 left-0 z-20 w-72 rounded-xl border border-border bg-surface shadow-xl">
        <div className="flex border-b border-border px-1">
          {CATEGORIES.map((c, i) => (
            <button
              key={c.key}
              onClick={() => setCat(i)}
              title={c.key}
              className={`flex-1 rounded-md py-1.5 text-lg transition ${i === cat ? "bg-brand-light" : "hover:bg-gray-100"}`}
            >
              {c.icon}
            </button>
          ))}
        </div>
        <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto p-2">
          {CATEGORIES[cat].emojis.map((e, i) => (
            <button
              key={`${e}-${i}`}
              onClick={() => onPick(e)}
              className="rounded p-1 text-xl transition hover:bg-gray-100"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
