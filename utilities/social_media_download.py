import streamlit as st
import yt_dlp
import instaloader
import praw  # For Reddit
import tweepy  # For Twitter

# Define your credentials here
CREDENTIALS = {
    "instagram": {
        "mid": "<replace>",
        "ig_did": "<with>",
        "csrftoken": "<your>",
        "ds_user_id": "<own>",
        "sessionid": "<cookies>"
    },
    "reddit": {
        "client_id": "<replace_this>",
        "client_secret": "<replace_this>",
        "refresh_token": "<replace_this>"
    },
    "twitter": {
        "auth_token": "<replace_this>",
        "ct0": "<replace_this>"
    },
    "youtube_oauth": "<output from running `pnpm run token:youtube` in `api` folder goes here>"
}

def download_social_media(url):
    if "youtube.com" in url or "youtu.be" in url:
        return download_youtube_video(url)
    elif "instagram.com" in url:
        return download_instagram_content(url)
    elif "reddit.com" in url:
        return download_reddit_content(url)
    elif "twitter.com" in url:
        return download_twitter_content(url)
    else:
        return "Unsupported URL"

def download_youtube_video(url):
    ydl_opts = {
        'format': 'best',
        'oauth': CREDENTIALS['youtube_oauth']
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=False)
        video_url = info_dict.get("url", None)
        return video_url

def download_instagram_content(url):
    loader = instaloader.Instaloader()
    loader.context.session.cookies.update(CREDENTIALS['instagram'])
    # Logic to download Instagram content
    return "Instagram content downloaded"

def download_reddit_content(url):
    reddit = praw.Reddit(
        client_id=CREDENTIALS['reddit']['client_id'],
        client_secret=CREDENTIALS['reddit']['client_secret'],
        refresh_token=CREDENTIALS['reddit']['refresh_token'],
        user_agent="my_user_agent"
    )
    # Logic to download Reddit content
    return "Reddit content downloaded"

def download_twitter_content(url):
    auth = tweepy.OAuth1UserHandler(
        CREDENTIALS['twitter']['auth_token'],
        CREDENTIALS['twitter']['ct0']
    )
    api = tweepy.API(auth)
    # Logic to download Twitter content
    return "Twitter content downloaded"

def social_media_download_page():
    st.subheader("Social Media Download Options")
    input_text = st.text_area(
        "Enter the social media URL here:",
        height=150,
        help="Enter the social media URL you want to download."
    )
    st.write("If your data input is a social media URL, click below to download its content.")
    if st.button("Download Social Media"):
        try:
            result = download_social_media(input_text)
            st.write(result)
        except Exception as e:
            st.error(f"Error downloading social media content: {e}") 