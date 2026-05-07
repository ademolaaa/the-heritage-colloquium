# How to Get Social Media Embed Codes

To display your official social media feed on the Heritage Colloquium website, you need an **Embed Code**. Follow the instructions below for your preferred platform.

## Option 1: Twitter (X) Timeline
This is the easiest and most reliable option for a live news feed.

1.  Go to **[publish.twitter.com](https://publish.twitter.com)**.
2.  Enter the URL of your profile (e.g., `https://twitter.com/AhiajokuLecture`).
3.  Select **Embedded Timeline**.
4.  Click **set customization options**:
    *   **Height**: Set to `600` (pixels).
    *   **Theme**: Select `Dark` (to match your website).
5.  Click **Update**.
6.  Click **Copy Code**.
7.  Paste this code into the **Social Feed Embed Code** field in your Admin Panel.

## Option 2: Instagram (Using a Widget Tool)
Instagram does not provide a direct "Timeline Embed" for websites anymore. You must use a free widget tool.

1.  Go to a free widget provider like **[Elfsight](https://elfsight.com/instagram-feed-instalink/)** or **[SnapWidget](https://snapwidget.com/)**.
2.  Create a free account.
3.  Connect your Instagram account.
4.  Choose a **Grid** or **Slider** layout.
5.  Customize the colors (use Black background to match the site).
6.  Click **Get Embed Code**.
7.  Copy the code (usually starts with `<script>` or `<iframe>`).
8.  Paste it into the Admin Panel.

## Option 3: Facebook Page Plugin
1.  Go to the **[Facebook Page Plugin](https://developers.facebook.com/docs/plugins/page-plugin/)** developer page.
2.  Enter your Facebook Page URL.
3.  **Tabs**: Enter `timeline`.
4.  **Width**: Leave empty (or `500`).
5.  **Height**: `600`.
6.  Check **Adapt to plugin container width**.
7.  Click **Get Code**.
8.  Select the **IFrame** tab (it's easier to use).
9.  Copy the code and paste it into the Admin Panel.

## Where to Paste the Code?
1.  Log in to your website admin at `/admin`.
2.  Go to **Home Page Settings** (or edit `server/db/content.json` directly).
3.  Find the field labeled **Social Feed Embed Code**.
4.  Paste the code exactly as copied.
5.  Save Changes.
