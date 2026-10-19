const sidebars = {
    tutorialSidebar: [
        "intro",
        {
            type: "category",
            label: "Providers",
            items: ["providers/provider-configurations"],
        },
        {
            type: "category",
            label: "Chat",
            items: ["chat/skills", "chat/commands", "chat/bash-sandbox"],
        },
    ],
};

module.exports = sidebars;
