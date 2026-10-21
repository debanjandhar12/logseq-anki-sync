export function handleTypeInTagVisibility() {
    if (window.type === "image_occlusion") return;
    const tags = document.getElementById("tags")?.getAttribute("tags_name")?.split(" ") || [];
    const container = document.querySelector(".type-in-container");
    if (tags.includes("type-in") && container) container.style.display = "block";
}
