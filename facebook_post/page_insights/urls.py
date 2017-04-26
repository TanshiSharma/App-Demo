from django.conf.urls import include, url
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Examples:
    # url(r'^$', 'facebook_post.views.home', name='home'),
    # url(r'^blog/', include('blog.urls')),
    url(r'^$', 'page_insights.views.index', name='page_insight_home'),
    url(r'^connect/$', 'page_insights.views.connect', name='facebook_connect'),
    url(r'^disconnect/$', 'page_insights.views.disconnect', name='facebook_disconnect'),
    url(r'^page-listing/$','page_insights.views.page_listing', name='list-pages'),
    url(r'^page-posts/(?P<page_id>[0-9]+)/$','page_insights.views.page_post',name='page-posts'),
    url(r'^get-page-posts/$','page_insights.views.get_page_posts',name='fetch-page-posts'),
    url(r'^get-post-impressions/','page_insights.views.get_posts_impressions', name='fetch-post-impressions'),
    url(r'^save-post/','page_insights.views.save_post',name='save-post'),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT) # app level static files
