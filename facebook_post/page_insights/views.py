from django.shortcuts import redirect
from django.conf import settings
from django.contrib import messages
from django.http import Http404, JsonResponse
from django.shortcuts import render_to_response
from django.template.context import RequestContext
from django.utils.translation import ugettext as _
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django_facebook import exceptions as facebook_exceptions, \
    settings as facebook_settings
from django_facebook.connect import CONNECT_ACTIONS, connect_user
from django_facebook.decorators import facebook_required_lazy
from django_facebook.utils import next_redirect, get_registration_backend, \
    to_bool, error_next_redirect, get_instance_for
from open_facebook import exceptions as open_facebook_exceptions
from open_facebook import OpenFacebook
from open_facebook.utils import send_warning
import logging
import json

try:
    unicode = unicode
except NameError:
    unicode = str

logger = logging.getLogger(__name__)


@csrf_exempt
@facebook_required_lazy
def connect(request, graph):
    '''
    Exception and validation functionality around the _connect view
    Separated this out from _connect to preserve readability
    Don't bother reading this code, skip to _connect for the bit you're interested in :)
    '''
    backend = get_registration_backend()
    context = RequestContext(request)

    try:
        response = _connect(request, graph)
    except open_facebook_exceptions.FacebookUnreachable as e:
        # often triggered when Facebook is slow
        warning_format = u'%s, often caused by Facebook slowdown, error %s'
        warn_message = warning_format % (type(e), str(e))
        send_warning(warn_message, e=e)
        additional_params = dict(fb_error_or_cancel=1)
        response = backend.post_error(request, additional_params)

    return response


def _connect(request, graph):
    '''
    Handles the view logic around connect user
    - (if authenticated) connect the user
    - login
    - register

    We are already covered by the facebook_required_lazy decorator
    So we know we either have a graph and permissions, or the user denied
    the oAuth dialog
    '''
    backend = get_registration_backend()
    context = RequestContext(request)
    connect_facebook = to_bool(request.REQUEST.get('connect_facebook'))

    logger.info('trying to connect using Facebook')
    if graph:
        logger.info('found a graph object')
        converter = get_instance_for('user_conversion', graph)
        authenticated = converter.is_authenticated()
        # Defensive programming :)
        if not authenticated:
            raise ValueError('didnt expect this flow')

        logger.info('Facebook is authenticated')
        facebook_data = converter.facebook_profile_data()
        # either, login register or connect the user
        try:
            action, user = connect_user(
                request, connect_facebook=connect_facebook)
            logger.info('Django facebook performed action: %s', action)
        except facebook_exceptions.IncompleteProfileError as e:
            # show them a registration form to add additional data
            warning_format = u'Incomplete profile data encountered with error %s'
            warn_message = warning_format % unicode(e)
            send_warning(warn_message, e=e,
                         facebook_data=facebook_data)

            context['facebook_mode'] = True
            context['form'] = e.form
            return render_to_response(
                backend.get_registration_template(),
                context_instance=context,
            )
        except facebook_exceptions.AlreadyConnectedError as e:
            user_ids = [u.get_user_id() for u in e.users]
            ids_string = ','.join(map(str, user_ids))
            additional_params = dict(already_connected=ids_string)
            return backend.post_error(request, additional_params)

        response = backend.post_connect(request, user, action)

        if action is CONNECT_ACTIONS.LOGIN:
            pass
        elif action is CONNECT_ACTIONS.CONNECT:
            # connect means an existing account was attached to facebook
            messages.info(request, _("You have connected your account "
                                     "to %s's facebook profile") % facebook_data['name'])
        elif action is CONNECT_ACTIONS.REGISTER:
            # hook for tying in specific post registration functionality
            response.set_cookie('fresh_registration', user.id)
    else:
        # the user denied the request
        additional_params = dict(fb_error_or_cancel='1')
        response = backend.post_error(request, additional_params)

    return response


def disconnect(request):
    '''
    Removes Facebook from the users profile
    And redirects to the specified next page
    '''
    if request.method == 'POST':
        messages.info(
            request, _("You have disconnected your Facebook profile."))
        profile = request.user.get_profile()
        profile.disconnect_facebook()
        profile.save()
    response = next_redirect(request)
    return response


def index(request):
    context = RequestContext(request)

    if request.user.is_authenticated():
        return redirect('list-pages')
    else:
        return render_to_response('index.html', context)

@facebook_required_lazy
def page_listing(request):
    facebook = OpenFacebook(request.user.access_token)
    details = facebook.get('me/accounts')
    details_dict = details
    page_info_list = []
    for entry in details_dict.get('data'):
        temp_dict = {'name': entry['name'], 'id': entry['id'], 'category': entry['category']}
        page_info_list.append(temp_dict)

    return render_to_response('listing.html',locals(),RequestContext(request))


@facebook_required_lazy
def page_post(request, page_id):
    page_name = request.GET.get('pname', 'Current')
    return render_to_response('page-posts.html', locals(), RequestContext(request))


@facebook_required_lazy
def get_page_posts(request):
    page_id = request.GET['page_id']
    next_url = request.GET['next_url']
    unpublished_url = request.GET['unpublished_next_url']
    skip_unpublished = request.GET.get('skip_unpublished', 'False')


    facebook = OpenFacebook(request.user.access_token)
    return_list = []

    # print unpublished_post
    unpublished_next_url=unpublished_url
    if skip_unpublished=='False':
        try:
            if unpublished_url:
                unpublished_post = facebook.get(unpublished_url.replace('https://graph.facebook.com/v2.8/', ''))
            else:
                unpublished_post = facebook.get('%s/promotable_posts/' % (page_id), is_published=False)
            print unpublished_post
            unpublished_next_url = unpublished_post['paging']['next']

            for post in unpublished_post['data']:
                if unpublished_url:
                    unpublished_url = None
                    continue
                return_list.append([post.get('message',post.get('story')),post['created_time'][:-5],
                                    '<input type="hidden" name="post_id" value="%s"/>'%(post['id']),"UnPublished"])
        except:
            unpublished_next_url = unpublished_url
            skip_unpublished = 'True'

    try:
        if next_url :
            feed_details = facebook.get(next_url.replace('https://graph.facebook.com/v2.8/', ''))
        else :
            feed_details = facebook.get('%s/posts/' %(page_id), limit=10)

        for element in feed_details['data']:
            if next_url:
                next_url = None
                continue
            return_list.append([element.get('message', element.get('story')), element['created_time'][:-5],
                                '<input type="hidden" name="post_id" value="%s"/>'%(element['id']),"Published"])

        new_next_url = feed_details['paging']['next']
        return JsonResponse({"sEcho": request.GET['sEcho'], "iTotalRecords": 100000, "iTotalDisplayRecords": 1000000,
                         "aaData": return_list, "next": new_next_url, "unpublished_next":unpublished_next_url,
                             "skip_unpublished": skip_unpublished})
    except:
        return JsonResponse({"sEcho": request.GET['sEcho'], "iTotalRecords": 100000, "iTotalDisplayRecords": 1,
                             "aaData": [], "next": '', "unpublished_next":unpublished_next_url,
                             "skip_unpublished": skip_unpublished})



@facebook_required_lazy
def get_posts_impressions(request):
    post_id = request.GET['post_id']
    facebook = OpenFacebook(request.user.access_token)
    impressions = facebook.get('%s/insights/post_impressions_unique' %(post_id))

    try:
        num_impression = impressions['data'][0]['values'][0]['value']
    except:
        num_impression = 'N/A'

    return JsonResponse({"impressions": num_impression})


@facebook_required_lazy
def save_post(request):
    if request.POST.get('publish-check'):
        published = True
    else:

        published = False
    message = request.POST['post-message']
    page_id = request.POST['page_id_post']

    user_facebook = OpenFacebook(request.user.access_token)
    response = user_facebook.get('me/accounts')
    # get page access token
    for entry in response['data']:
        if entry['id'] == page_id:
            page_access_token = entry['access_token']
            break
    facebook = OpenFacebook(page_access_token)
    facebook.set('%s/feed' %(page_id), message = message, published=published)

    return redirect('page-posts', page_id)

