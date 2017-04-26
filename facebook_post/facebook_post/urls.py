from django.conf.urls import include, url
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Examples:
    # url(r'^$', 'facebook_post.views.home', name='home'),
    # url(r'^blog/', include('blog.urls')),

    url(r'^facebook/', include('django_facebook.urls')),
    url(r'^accounts/', include('django_facebook.auth_urls')),
    url(r'^page-insights/', include('page_insights.urls')),


] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
