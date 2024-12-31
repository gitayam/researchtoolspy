import streamlit as st
import yt_dlp
import instaloader
import praw  # For Reddit
import tweepy  # For Twitter
import dotenv
import os

dotenv.load_dotenv()


# Define your credentials here
CREDENTIALS = {
    "instagram": {
        "mid": os.getenv("INSTAGRAM_MID"),
        "ig_did": os.getenv("INSTAGRAM_IG_DID"),
        "csrftoken": os.getenv("INSTAGRAM_CSRFTOKEN"),
        "ds_user_id": os.getenv("INSTAGRAM_DS_USER_ID"),
        "sessionid": os.getenv("INSTAGRAM_SESSIONID")
    },
    "reddit": {
        "client_id": os.getenv("REDDIT_CLIENT_ID"),
        "client_secret": os.getenv("REDDIT_CLIENT_SECRET"),
        "refresh_token": os.getenv("REDDIT_REFRESH_TOKEN")
    },
    "twitter": {
        "auth_token": os.getenv("TWITTER_AUTH_TOKEN"),
        "ct0": os.getenv("TWITTER_CT0")
    },
    "youtube_oauth": os.getenv("YOUTUBE_OAUTH")
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
    }
    if CREDENTIALS['youtube_oauth']:
        ydl_opts['oauth'] = CREDENTIALS['youtube_oauth']
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=False)
        video_url = info_dict.get("url", None)
        return video_url

def download_instagram_content(url):
    loader = instaloader.Instaloader()
    if all(CREDENTIALS['instagram'].values()):
        loader.context.session.cookies.update(CREDENTIALS['instagram'])
        # Logic to download Instagram content with credentials
        return "Instagram content downloaded with credentials"
    else:
        # Logic to download Instagram content without credentials
        return "Instagram content downloaded without credentials"

def download_reddit_content(url):
    if all(CREDENTIALS['reddit'].values()):
        reddit = praw.Reddit(
            client_id=CREDENTIALS['reddit']['client_id'],
            client_secret=CREDENTIALS['reddit']['client_secret'],
            refresh_token=CREDENTIALS['reddit']['refresh_token'],
            user_agent="my_user_agent"
        )
        # Logic to download Reddit content with credentials
        return "Reddit content downloaded with credentials"
    else:
        # Logic to download Reddit content without credentials
        return "Reddit content downloaded without credentials"

def download_twitter_content(url):
    if all(CREDENTIALS['twitter'].values()):
        auth = tweepy.OAuth1UserHandler(
            CREDENTIALS['twitter']['auth_token'],
            CREDENTIALS['twitter']['ct0']
        )
        api = tweepy.API(auth)
        # Logic to download Twitter content with credentials
        return "Twitter content downloaded with credentials"
    else:
        # Logic to download Twitter content without credentials
        return "Twitter content downloaded without credentials"

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